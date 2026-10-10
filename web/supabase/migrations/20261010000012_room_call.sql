-- One call type per room: the person who invites picks Video / Audio / No call, it applies to everyone,
-- and anyone in the room can switch it for everyone (e.g. video → audio on a weak connection).

alter table public.session_invites add column call_mode text not null default 'none' check (call_mode in ('video', 'audio', 'none'));
alter table public.co_sessions add column call_mode text not null default 'none' check (call_mode in ('video', 'audio', 'none'));
alter table public.co_sessions add column call_changed_by uuid references auth.users (id) on delete set null;
alter table public.co_sessions add column call_changed_at timestamptz;

-- ───────────── join: the room takes the invite's call type ─────────────
drop function private.join_co_session(uuid, int, uuid);
create or replace function private.join_co_session(p_group uuid, p_minutes int, p_host uuid, p_call text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cs uuid; k text;
begin
  select kind into k from public.groups where id = p_group;
  if k = 'pair' then
    cs := private.open_co_session(p_group, p_minutes);
    update public.co_sessions set call_mode = p_call where id = cs;
    return cs;
  end if;
  select id into cs from public.co_sessions where group_id = p_group and status <> 'ended' order by created_at desc limit 1;
  if cs is null then
    insert into public.co_sessions (group_id, minutes, call_mode) values (p_group, p_minutes, p_call) returning id into cs;
    insert into public.co_session_members (co_session_id, user_id) values (cs, p_host);
  end if;
  insert into public.co_session_members (co_session_id, user_id) values (cs, auth.uid())
    on conflict (co_session_id, user_id) do update set left_at = null;
  return cs;
end $$;

drop function public.send_session_invite(int, uuid[]);
create or replace function public.send_session_invite(p_minutes int, p_friends uuid[] default null, p_call text default 'none')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  friends uuid[] := coalesce(p_friends, array[public.my_partner()]);
  call text := case when p_call in ('video', 'audio', 'none') then p_call else 'none' end;
  f uuid; g uuid; mode text; theirs public.session_invites; cs uuid; inv uuid; sent int := 0; n int;
begin
  friends := array(select distinct x from unnest(friends) x where x is not null and x <> me);
  n := coalesce(array_length(friends, 1), 0);
  if n = 0 then return jsonb_build_object('status', 'no_partner'); end if;
  if n > 4 then return jsonb_build_object('status', 'too_many'); end if;
  foreach f in array friends loop
    if not public.is_partner(f) then return jsonb_build_object('status', 'not_friends'); end if;
  end loop;
  if (select count(*) from public.session_invites where from_user = me and created_at > now() - interval '1 hour') >= 12 then
    return jsonb_build_object('status', 'limit');
  end if;

  if n = 1 then
    g := private.pair_group(me, friends[1]);
    -- Both invited at once: join theirs (their call type wins — they asked first).
    select * into theirs from public.session_invites where from_user = friends[1] and to_user = me and status in ('pending','snoozed','later') and expires_at > now()
      order by created_at desc limit 1;
    if theirs.id is not null then
      cs := private.join_co_session(theirs.group_id, theirs.minutes, theirs.from_user, theirs.call_mode);
      update public.session_invites set status = 'accepted', responded_at = now(), co_session_id = cs where id = theirs.id;
      return jsonb_build_object('status', 'joined', 'co_session_id', cs);
    end if;
  else
    insert into public.groups (kind, created_by) values ('room', me) returning id into g;
    insert into public.group_members (group_id, user_id) select g, x from unnest(array_append(friends, me)) x;
  end if;

  update public.session_invites set status = 'cancelled' where from_user = me and status in ('pending','snoozed','later');
  foreach f in array friends loop
    select invites_mode into mode from public.settings where owner_id = f;
    continue when mode = 'off';
    continue when mode = 'online_only' and not exists (select 1 from public.presence where user_id = f and updated_at > now() - interval '90 seconds');
    insert into public.session_invites (group_id, from_user, to_user, minutes, party, call_mode)
      values (g, me, f, greatest(10, least(120, p_minutes)), n, call) returning id into inv;
    sent := sent + 1;
  end loop;
  if sent = 0 then return jsonb_build_object('status', case when n = 1 and mode = 'off' then 'off' when n = 1 then 'offline_only' else 'nobody' end); end if;
  return jsonb_build_object('status', 'sent', 'id', inv, 'sent', sent);
end $$;

create or replace function public.respond_session_invite(p_id uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); i public.session_invites; cs uuid;
begin
  select * into i from public.session_invites where id = p_id and to_user = me and status in ('pending','snoozed','later') and expires_at > now();
  if i.id is null then return jsonb_build_object('status', 'gone'); end if;
  if p_action = 'accept' then
    cs := private.join_co_session(i.group_id, i.minutes, i.from_user, i.call_mode);
    update public.session_invites set status = 'accepted', responded_at = now(), co_session_id = cs where id = p_id;
    return jsonb_build_object('status', 'accepted', 'co_session_id', cs);
  elsif p_action = 'snooze' then
    update public.session_invites set status = 'snoozed', snooze_until = now() + interval '10 minutes',
      expires_at = greatest(expires_at, now() + interval '25 minutes'), responded_at = now() where id = p_id;
  elsif p_action = 'later' then
    update public.session_invites set status = 'later', responded_at = now() where id = p_id;
  else
    update public.session_invites set status = 'declined', responded_at = now() where id = p_id;
  end if;
  return jsonb_build_object('status', p_action);
end $$;

-- Switch the call for everyone in the room.
create or replace function public.co_set_call(p_cs uuid, p_call text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.co_sessions := private.require_member(p_cs);
begin
  if p_call not in ('video', 'audio', 'none') then raise exception 'bad_call' using errcode = 'P0001'; end if;
  if c.call_mode is distinct from p_call then
    update public.co_sessions set call_mode = p_call, call_changed_by = auth.uid(), call_changed_at = now() where id = p_cs;
  end if;
end $$;

revoke all on function private.join_co_session(uuid, int, uuid, text) from public, anon, authenticated;
revoke execute on function public.send_session_invite(int, uuid[], text), public.co_set_call(uuid, text) from public, anon;
