-- Friends: many study friends instead of one partner, sharing chosen per friend, and group study rooms
-- (2–5 people) with a group call. A friendship is still a "pair" group of two; a group session gets its
-- own short-lived "room" group. Partners still read each other only through definer functions.

-- ───────────── schema ─────────────
alter table public.groups drop constraint groups_kind_check;
alter table public.groups add constraint groups_kind_check check (kind in ('pair', 'room'));
alter table public.groups add column created_by uuid references auth.users (id) on delete set null;

-- What I share with the other person in this friendship (null = my default from settings).
alter table public.group_members add column share_level text check (share_level in ('exact', 'count', 'private'));

-- How many friends one invite went to (for "Sam + 2 others").
alter table public.session_invites add column party smallint not null default 1 check (party between 1 and 4);

-- Group calls connect everyone to everyone, so a signal names its recipient (null = everyone, older clients).
alter table public.call_signals add column to_user uuid references auth.users (id) on delete cascade;

-- ───────────── helpers ─────────────
-- Friends = the other member of each active pair group. Rooms never make people friends.
create or replace function public.is_partner(p_other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    join public.groups g on g.id = a.group_id and g.kind = 'pair'
    where a.user_id = (select auth.uid()) and b.user_id = p_other and a.left_at is null and b.left_at is null and p_other <> a.user_id
  );
$$;

create or replace function private.pair_group(a uuid, b uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select ga.group_id from public.group_members ga
  join public.group_members gb on gb.group_id = ga.group_id
  join public.groups g on g.id = ga.group_id and g.kind = 'pair'
  where ga.user_id = a and gb.user_id = b and ga.left_at is null and gb.left_at is null
  limit 1;
$$;

create or replace function private.friend_count(u uuid)
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.group_members m join public.groups g on g.id = m.group_id and g.kind = 'pair'
  where m.user_id = u and m.left_at is null;
$$;

create or replace function public.my_partner()
returns uuid language sql stable security definer set search_path = '' as $$
  select b.user_id from public.group_members a
  join public.group_members b on a.group_id = b.group_id
  join public.groups g on g.id = a.group_id and g.kind = 'pair'
  where a.user_id = (select auth.uid()) and a.left_at is null and b.left_at is null and b.user_id <> a.user_id
  order by a.joined_at limit 1;
$$;

-- ───────────── making friends ─────────────
create or replace function private.make_pair(a uuid, b uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  if private.pair_group(a, b) is not null then raise exception 'already_friends' using errcode = 'P0001'; end if;
  if private.friend_count(a) >= 30 or private.friend_count(b) >= 30 then raise exception 'too_many_friends' using errcode = 'P0001'; end if;
  insert into public.groups (kind, created_by) values ('pair', a) returning id into g;
  insert into public.group_members (group_id, user_id) values (g, a), (g, b);
  update public.partner_requests set status = 'cancelled', responded_at = now()
    where status = 'pending' and ((from_user = a and to_user = b) or (from_user = b and to_user = a));
  return g;
end $$;

create or replace function public.request_partner(p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); them uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select user_id into them from public.find_partner_code(p_code);
  if them is null then return 'not_found'; end if; -- also returned when they blocked you
  if private.pair_group(me, them) is not null then return 'already_friends'; end if;
  if private.friend_count(me) >= 30 then return 'too_many_friends'; end if;
  if (select count(*) from public.partner_requests where from_user = me and created_at > now() - interval '1 day') >= 10
     or (select count(*) from public.partner_requests where from_user = me and status = 'pending' and expires_at > now()) >= 5 then
    return 'limit';
  end if;
  -- They already asked you: accept instead of crossing requests.
  if exists (select 1 from public.partner_requests where from_user = them and to_user = me and status = 'pending' and expires_at > now()) then
    update public.partner_requests set status = 'accepted', responded_at = now() where from_user = them and to_user = me and status = 'pending';
    perform private.make_pair(me, them);
    return 'paired';
  end if;
  insert into public.partner_requests (from_user, to_user) values (me, them)
    on conflict (from_user, to_user) where status = 'pending' do nothing;
  return 'sent';
end $$;

create or replace function public.accept_invite_link(p_token text)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); l public.invite_links;
begin
  select * into l from public.invite_links where token = p_token and used_at is null and expires_at > now();
  if l.token is null or l.from_user = me then return 'invalid'; end if;
  if exists (select 1 from public.blocks where blocker = me and blocked = l.from_user) then return 'invalid'; end if;
  if private.pair_group(me, l.from_user) is not null then return 'already_friends'; end if;
  update public.invite_links set used_at = now(), used_by = me where token = p_token;
  perform private.make_pair(l.from_user, me);
  return 'paired';
end $$;

-- Remove one friend: stops all sharing with them at once (the old leave_partner removes the first friend).
create or replace function public.remove_friend(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare g uuid := private.pair_group(auth.uid(), p_user);
begin
  if g is null then return; end if;
  update public.group_members set left_at = now() where group_id = g and left_at is null;
  update public.session_invites set status = 'cancelled' where group_id = g and status in ('pending','snoozed','later');
  update public.co_sessions set status = 'ended', ended_at = now() where group_id = g and status <> 'ended';
end $$;

create or replace function public.leave_partner()
returns void language sql security definer set search_path = '' as $$
  select public.remove_friend(public.my_partner());
$$;

-- What I share with one friend.
create or replace function public.set_friend_share(p_user uuid, p_level text)
returns void language plpgsql security definer set search_path = '' as $$
declare g uuid := private.pair_group(auth.uid(), p_user);
begin
  if g is null or p_level not in ('exact','count','private') then raise exception 'not_friends' using errcode = 'P0001'; end if;
  update public.group_members set share_level = p_level where group_id = g and user_id = auth.uid();
end $$;

-- ───────────── what a friend may see (applies the level they chose for me) ─────────────
create or replace function private.friend_view(them uuid, g uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  s public.settings; p public.profiles; lvl text;
  tz text; boundary int; today date; d_start timestamptz; d_end timestamptz; w_start date; w_from timestamptz; lw_from timestamptz;
  pres public.presence; snap jsonb; mine text;
begin
  select * into s from public.settings where owner_id = them;
  select * into p from public.profiles where user_id = them;
  select coalesce(m.share_level, s.share_level) into lvl from public.group_members m where m.group_id = g and m.user_id = them;
  select coalesce(m.share_level, (select share_level from public.settings where owner_id = auth.uid())) into mine
    from public.group_members m where m.group_id = g and m.user_id = auth.uid();
  tz := p.timezone; boundary := p.day_boundary_hour;
  today := ((now() at time zone tz) - make_interval(hours => boundary))::date;
  d_start := (today::timestamp + make_interval(hours => boundary)) at time zone tz;
  d_end := d_start + interval '1 day';
  w_start := today - ((extract(isodow from today)::int) - 1);
  w_from := (w_start::timestamp + make_interval(hours => boundary)) at time zone tz;
  lw_from := w_from - interval '7 days';
  if s.presence_visible then select * into pres from public.presence where user_id = them; end if;

  snap := jsonb_build_object(
    'user_id', them, 'group_id', g, 'username', p.username::text, 'display_name', p.display_name,
    'share_level', lvl, 'my_share_level', mine, 'invites_mode', s.invites_mode, 'call_link', s.call_link, 'today', today,
    'presence', case when pres.user_id is null then null else jsonb_build_object(
      'status', case when pres.updated_at < now() - interval '90 seconds' then 'offline' else pres.status end,
      'focus_until', pres.focus_until, 'updated_at', pres.updated_at) end
  );
  if lvl = 'private' then return snap; end if;

  snap := snap || jsonb_build_object(
    'planned', (select count(*) from public.tasks t where t.owner_id = them and coalesce(t.share_override, '') <> 'private'
                 and ((t.status in ('today','evening') and coalesce(t.planned_for, today) <= today) or (t.status = 'done' and t.completed_at >= d_start and t.completed_at < d_end))),
    'done', (select count(*) from public.tasks t where t.owner_id = them and coalesce(t.share_override, '') <> 'private'
              and t.status = 'done' and t.completed_at >= d_start and t.completed_at < d_end),
    'focus_today', (select coalesce(sum(active_seconds), 0) / 60 from public.sessions where owner_id = them and started_at >= d_start and started_at < d_end and ended_at is not null),
    'focus_week', (select coalesce(sum(active_seconds), 0) / 60 from public.sessions where owner_id = them and started_at >= w_from and ended_at is not null),
    'focus_last_week', (select coalesce(sum(active_seconds), 0) / 60 from public.sessions where owner_id = them and started_at >= lw_from and started_at < w_from and ended_at is not null),
    'slipped_today', (select count(*) from public.block_outcomes o join public.calendar_blocks b on b.id = o.block_id
                       where o.owner_id = them and o.outcome = 'missed' and b.start_at >= d_start and b.start_at < d_end),
    'kept_week', (select count(*) from public.block_outcomes o join public.calendar_blocks b on b.id = o.block_id
                   where o.owner_id = them and o.outcome = 'kept' and b.start_at >= w_from),
    'outcomes_week', (select count(*) from public.outcomes where owner_id = them and week_start = w_start),
    'outcomes_met', (select count(*) from public.outcomes where owner_id = them and week_start = w_start and result = 'met')
  );
  if lvl = 'exact' then
    snap := snap || jsonb_build_object(
      'tasks', coalesce((select jsonb_agg(jsonb_build_object('title', coalesce(t.first_action, t.title), 'done', t.status = 'done') order by t.status = 'done', t.sort_order)
                         from public.tasks t where t.owner_id = them and coalesce(t.share_override, 'exact') = 'exact'
                           and ((t.status in ('today','evening') and coalesce(t.planned_for, today) <= today) or (t.status = 'done' and t.completed_at >= d_start and t.completed_at < d_end))), '[]'::jsonb),
      'outcomes', coalesce((select jsonb_agg(jsonb_build_object('text', o.text, 'result', o.result) order by o.sort_order) from public.outcomes o where o.owner_id = them and o.week_start = w_start), '[]'::jsonb)
    );
  end if;
  return snap;
end $$;

create or replace function public.friends_snapshot()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(private.friend_view(b.user_id, a.group_id) order by a.joined_at), '[]'::jsonb)
  from public.group_members a
  join public.group_members b on b.group_id = a.group_id and b.user_id <> a.user_id and b.left_at is null
  join public.groups g on g.id = a.group_id and g.kind = 'pair'
  where a.user_id = (select auth.uid()) and a.left_at is null;
$$;

-- Kept for older callers: the first friend.
create or replace function public.partner_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare them uuid := public.my_partner();
begin
  if them is null then return null; end if;
  return private.friend_view(them, private.pair_group(auth.uid(), them));
end $$;

-- Combined focus minutes this week for one friendship's shared goal.
drop function public.pair_quest();
create or replace function public.pair_quest(p_group uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare g uuid; total int := 0; m record; target int;
begin
  g := coalesce(p_group, private.pair_group(auth.uid(), public.my_partner()));
  if g is null or g not in (select public.my_group_ids()) then return null; end if;
  for m in select gm.user_id, pr.timezone, pr.day_boundary_hour from public.group_members gm join public.profiles pr on pr.user_id = gm.user_id
           where gm.group_id = g and gm.left_at is null loop
    total := total + coalesce((select sum(active_seconds) / 60 from public.sessions s where s.owner_id = m.user_id and s.ended_at is not null
      and s.started_at >= ((((now() at time zone m.timezone) - make_interval(hours => m.day_boundary_hour))::date
            - (extract(isodow from ((now() at time zone m.timezone) - make_interval(hours => m.day_boundary_hour))::date)::int - 1))::timestamp
            + make_interval(hours => m.day_boundary_hour)) at time zone m.timezone), 0);
  end loop;
  select quest_minutes into target from public.groups where id = g;
  return jsonb_build_object('group_id', g, 'minutes', total, 'target', target);
end $$;

-- ───────────── focus together: one friend (their pair) or several (a room) ─────────────
drop function public.send_session_invite(int);
create or replace function public.send_session_invite(p_minutes int, p_friends uuid[] default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  friends uuid[] := coalesce(p_friends, array[public.my_partner()]);
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
    -- Both invited at once: join theirs.
    select * into theirs from public.session_invites where from_user = friends[1] and to_user = me and status in ('pending','snoozed','later') and expires_at > now()
      order by created_at desc limit 1;
    if theirs.id is not null then
      cs := private.join_co_session(theirs.group_id, theirs.minutes, theirs.from_user);
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
    insert into public.session_invites (group_id, from_user, to_user, minutes, party)
      values (g, me, f, greatest(10, least(120, p_minutes)), n) returning id into inv;
    sent := sent + 1;
  end loop;
  if sent = 0 then return jsonb_build_object('status', case when n = 1 and mode = 'off' then 'off' when n = 1 then 'offline_only' else 'nobody' end); end if;
  return jsonb_build_object('status', 'sent', 'id', inv, 'sent', sent);
end $$;

-- Join (or open) the group's session. Pairs open a fresh session with both; rooms add people as they accept.
create or replace function private.join_co_session(p_group uuid, p_minutes int, p_host uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cs uuid; k text;
begin
  select kind into k from public.groups where id = p_group;
  if k = 'pair' then return private.open_co_session(p_group, p_minutes); end if;
  select id into cs from public.co_sessions where group_id = p_group and status <> 'ended' order by created_at desc limit 1;
  if cs is null then
    insert into public.co_sessions (group_id, minutes) values (p_group, p_minutes) returning id into cs;
    insert into public.co_session_members (co_session_id, user_id) values (cs, p_host);
  end if;
  insert into public.co_session_members (co_session_id, user_id) values (cs, auth.uid())
    on conflict (co_session_id, user_id) do update set left_at = null;
  return cs;
end $$;

create or replace function public.respond_session_invite(p_id uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); i public.session_invites; cs uuid;
begin
  select * into i from public.session_invites where id = p_id and to_user = me and status in ('pending','snoozed','later') and expires_at > now();
  if i.id is null then return jsonb_build_object('status', 'gone'); end if;
  if p_action = 'accept' then
    cs := private.join_co_session(i.group_id, i.minutes, i.from_user);
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

-- Ready: shares task/goal only at the level chosen for this friendship (rooms use the default).
create or replace function public.co_ready(p_cs uuid, p_goal text, p_task_title text, p_call text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare c public.co_sessions := private.require_member(p_cs); lvl text;
begin
  select coalesce(m.share_level, s.share_level) into lvl
    from public.settings s left join public.group_members m on m.group_id = c.group_id and m.user_id = s.owner_id
    where s.owner_id = auth.uid();
  update public.co_session_members set ready = true, goal_set = coalesce(trim(p_goal), '') <> '',
    goal_text = case when lvl = 'exact' then nullif(trim(p_goal), '') else null end,
    task_title = case when lvl = 'exact' then nullif(trim(p_task_title), '') else null end,
    call_choice = p_call, result = null, wants_next = false
  where co_session_id = p_cs and user_id = auth.uid();
  if c.status = 'checkin' and not exists (select 1 from public.co_session_members where co_session_id = p_cs and left_at is null and not ready) then
    update public.co_sessions set status = 'running', starts_at = now() + interval '4 seconds' where id = p_cs and status = 'checkin';
  end if;
  return (select starts_at from public.co_sessions where id = p_cs);
end $$;

-- Leaving the last seat ends the session; a finished room dissolves (no lasting link between room-mates).
create or replace function public.co_leave(p_cs uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  update public.co_session_members set left_at = now() where co_session_id = p_cs and user_id = auth.uid() and left_at is null;
  select group_id into g from public.co_sessions where id = p_cs;
  if not exists (select 1 from public.co_session_members where co_session_id = p_cs and left_at is null) then
    update public.co_sessions set status = 'ended', ended_at = now() where id = p_cs;
  end if;
  if exists (select 1 from public.groups where id = g and kind = 'room') then
    update public.group_members set left_at = now() where group_id = g and user_id = auth.uid() and left_at is null;
  end if;
end $$;

-- Names of the people in a session I'm in (rooms can include friends-of-friends: name only, nothing else).
create or replace function public.session_people(p_cs uuid)
returns table (user_id uuid, username text, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.username::text, p.display_name from public.co_session_members m join public.profiles p on p.user_id = m.user_id
  where m.co_session_id = p_cs and p_cs in (select cm.co_session_id from public.co_session_members cm where cm.user_id = (select auth.uid()));
$$;

-- Who sent me an invite, and who else was asked (names only).
create or replace function public.invite_people(p_invite uuid)
returns table (user_id uuid, username text, display_name text, is_host boolean)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.username::text, p.display_name, p.user_id = i.from_user
  from public.session_invites i join public.group_members m on m.group_id = i.group_id join public.profiles p on p.user_id = m.user_id
  where i.id = p_invite and i.to_user = (select auth.uid()) and m.user_id <> (select auth.uid());
$$;

-- ───────────── policies ─────────────
-- Shared goals, lists and reactions belong to a friendship (pair) only.
drop policy reactions_insert on public.reactions;
create policy reactions_insert on public.reactions for insert to authenticated
  with check (from_user = (select auth.uid()) and public.is_partner(to_user) and group_id = private.pair_group((select auth.uid()), to_user));

drop policy call_signals_insert on public.call_signals;
create policy call_signals_insert on public.call_signals for insert to authenticated
  with check (from_user = (select auth.uid())
    and co_session_id in (select id from public.co_sessions where group_id in (select public.my_group_ids()) and status <> 'ended')
    and (to_user is null or to_user in (select m.user_id from public.co_session_members m where m.co_session_id = call_signals.co_session_id)));

revoke all on function private.pair_group(uuid, uuid), private.friend_count(uuid), private.friend_view(uuid, uuid), private.join_co_session(uuid, int, uuid)
  from public, anon, authenticated;
revoke execute on function public.remove_friend(uuid), public.set_friend_share(uuid, text), public.friends_snapshot(), public.pair_quest(uuid),
  public.send_session_invite(int, uuid[]), public.session_people(uuid), public.invite_people(uuid)
  from public, anon;
