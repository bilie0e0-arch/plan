-- M4: Partner mode (pairs now; the same tables carry groups later).
-- Principles: nothing is shared without consent; "count" sharing is the default; partners read each other
-- only through security-definer functions that apply the sharing level — base tables stay owner-only.

-- ───────────── settings: sharing, presence, invites, call link, audio retention choice ─────────────
alter table public.settings
  add column share_level text not null default 'count' check (share_level in ('exact','count','private')),
  add column presence_visible boolean not null default true,
  add column invites_mode text not null default 'allowed' check (invites_mode in ('allowed','online_only','off')),
  add column call_link text check (call_link is null or call_link ~ '^https://'),
  add column work_mode text not null default 'solo' check (work_mode in ('solo','pair')),
  add column work_mode_on date,
  add column keep_audio boolean not null default false;

-- Per-task override of the sharing level (null = use the default).
alter table public.tasks add column share_override text check (share_override in ('exact','count','private'));

-- ───────────── partner code (like a game player tag) ─────────────
create or replace function private.new_partner_code()
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; -- no 0/O, 1/I/L
  code text;
begin
  loop
    code := 'PLN-';
    for i in 1..5 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where partner_code = code);
  end loop;
  return code;
end $$;

alter table public.profiles add column partner_code text unique;
update public.profiles set partner_code = private.new_partner_code() where partner_code is null;
alter table public.profiles alter column partner_code set not null;
alter table public.profiles alter column partner_code set default private.new_partner_code();

-- ───────────── groups (a pair is a group of two) ─────────────
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'pair' check (kind in ('pair')),
  quest_minutes integer not null default 600 check (quest_minutes between 60 and 6000),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id) where left_at is null;

create table public.partner_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  responded_at timestamptz,
  check (from_user <> to_user)
);
create unique index partner_requests_one_pending on public.partner_requests (from_user, to_user) where status = 'pending';

create table public.invite_links (
  token text primary key default encode(extensions.gen_random_bytes(16), 'hex'),
  from_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null
);

create table public.blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

-- Heartbeat presence (polling-friendly; Realtime can replace it later).
create table public.presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'online' check (status in ('online','focus','break')),
  focus_until timestamptz,
  updated_at timestamptz not null default now()
);

-- "Let's do it together" invites
create table public.session_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  minutes smallint not null default 50 check (minutes between 10 and 120),
  status text not null default 'pending' check (status in ('pending','snoozed','later','accepted','declined','expired','cancelled')),
  snooze_until timestamptz,
  co_session_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes',
  responded_at timestamptz,
  seen_by_sender_at timestamptz,
  pushed_at timestamptz
);
create index session_invites_to_idx on public.session_invites (to_user, status);

-- Pair sessions (rounds of focus together)
create table public.co_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  minutes smallint not null check (minutes between 10 and 120),
  round smallint not null default 1,
  status text not null default 'checkin' check (status in ('checkin','running','break','ended')),
  starts_at timestamptz,
  break_until timestamptz,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
alter table public.session_invites add foreign key (co_session_id) references public.co_sessions (id) on delete set null;

create table public.co_session_members (
  co_session_id uuid not null references public.co_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  ready boolean not null default false,
  goal_set boolean not null default false,
  goal_text text check (char_length(goal_text) <= 200),   -- only filled when the member shares exactly
  task_title text check (char_length(task_title) <= 200), -- only filled when the member shares exactly
  call_choice text check (call_choice in ('video','audio','none')),
  result text check (result in ('yes','partial','no')),
  wants_next boolean not null default false,
  left_at timestamptz,
  primary key (co_session_id, user_id)
);

alter table public.sessions add column co_session_id uuid references public.co_sessions (id) on delete set null;

-- WebRTC signalling over plain rows (polled); cleaned up with the session.
create table public.call_signals (
  id bigint generated always as identity primary key,
  co_session_id uuid not null references public.co_sessions (id) on delete cascade,
  from_user uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('offer','answer','ice','bye')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index call_signals_session_idx on public.call_signals (co_session_id, id);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_user uuid not null default auth.uid() references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('clap','strong','nudge')),
  note text check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index reactions_to_idx on public.reactions (to_user, created_at desc);

-- Common list (same work, e.g. exam prep): one list both edit; the partner must accept it first.
create table public.shared_lists (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.shared_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shared_lists (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  done_at timestamptz,
  done_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ───────────── membership helpers ─────────────
create or replace function public.my_group_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select group_id from public.group_members where user_id = (select auth.uid()) and left_at is null;
$$;

create or replace function public.is_partner(p_other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members a join public.group_members b on a.group_id = b.group_id
    where a.user_id = (select auth.uid()) and b.user_id = p_other and a.left_at is null and b.left_at is null and p_other <> a.user_id
  );
$$;

create or replace function public.my_partner()
returns uuid language sql stable security definer set search_path = '' as $$
  select b.user_id from public.group_members a join public.group_members b on a.group_id = b.group_id
  where a.user_id = (select auth.uid()) and a.left_at is null and b.left_at is null and b.user_id <> a.user_id
  limit 1;
$$;

-- Settings are owner-only, so the presence policy asks through a definer function.
create or replace function public.shows_presence(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select presence_visible from public.settings where owner_id = p_user), false);
$$;

create or replace function public.server_now() returns timestamptz language sql stable as $$ select now() $$;

-- ───────────── RLS ─────────────
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.partner_requests enable row level security;
alter table public.invite_links enable row level security;
alter table public.blocks enable row level security;
alter table public.presence enable row level security;
alter table public.session_invites enable row level security;
alter table public.co_sessions enable row level security;
alter table public.co_session_members enable row level security;
alter table public.call_signals enable row level security;
alter table public.reactions enable row level security;
alter table public.shared_lists enable row level security;
alter table public.shared_list_items enable row level security;

create policy groups_select on public.groups for select to authenticated using (id in (select public.my_group_ids()));
create policy groups_update on public.groups for update to authenticated using (id in (select public.my_group_ids())) with check (id in (select public.my_group_ids()));
create policy group_members_select on public.group_members for select to authenticated
  using (group_id in (select public.my_group_ids()));

create policy partner_requests_select on public.partner_requests for select to authenticated
  using (from_user = (select auth.uid()) or to_user = (select auth.uid()));
create policy invite_links_select on public.invite_links for select to authenticated using (from_user = (select auth.uid()));
create policy invite_links_delete on public.invite_links for delete to authenticated using (from_user = (select auth.uid()));
create policy blocks_select on public.blocks for select to authenticated using (blocker = (select auth.uid()));
create policy blocks_delete on public.blocks for delete to authenticated using (blocker = (select auth.uid()));

-- Presence: your own row; your partner's row only if they show their status.
create policy presence_select on public.presence for select to authenticated using (
  user_id = (select auth.uid())
  or (public.is_partner(user_id) and public.shows_presence(user_id))
);
create policy presence_insert on public.presence for insert to authenticated with check (user_id = (select auth.uid()));
create policy presence_update on public.presence for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy session_invites_select on public.session_invites for select to authenticated
  using (from_user = (select auth.uid()) or to_user = (select auth.uid()));
create policy session_invites_update_sender on public.session_invites for update to authenticated
  using (from_user = (select auth.uid())) with check (from_user = (select auth.uid()));

create policy co_sessions_select on public.co_sessions for select to authenticated using (group_id in (select public.my_group_ids()));
create policy co_session_members_select on public.co_session_members for select to authenticated
  using (co_session_id in (select id from public.co_sessions where group_id in (select public.my_group_ids())));

create policy call_signals_select on public.call_signals for select to authenticated
  using (co_session_id in (select id from public.co_sessions where group_id in (select public.my_group_ids())));
create policy call_signals_insert on public.call_signals for insert to authenticated
  with check (from_user = (select auth.uid()) and co_session_id in (select id from public.co_sessions where group_id in (select public.my_group_ids()) and status <> 'ended'));

create policy reactions_select on public.reactions for select to authenticated
  using (from_user = (select auth.uid()) or to_user = (select auth.uid()));
create policy reactions_insert on public.reactions for insert to authenticated
  with check (from_user = (select auth.uid()) and public.is_partner(to_user) and group_id in (select public.my_group_ids()));
create policy reactions_update on public.reactions for update to authenticated
  using (to_user = (select auth.uid())) with check (to_user = (select auth.uid()));

create policy shared_lists_select on public.shared_lists for select to authenticated using (group_id in (select public.my_group_ids()));
create policy shared_lists_insert on public.shared_lists for insert to authenticated
  with check (created_by = (select auth.uid()) and group_id in (select public.my_group_ids()));
create policy shared_lists_update on public.shared_lists for update to authenticated
  using (group_id in (select public.my_group_ids())) with check (group_id in (select public.my_group_ids()));
create policy shared_lists_delete on public.shared_lists for delete to authenticated using (created_by = (select auth.uid()));
create policy shared_list_items_select on public.shared_list_items for select to authenticated
  using (list_id in (select id from public.shared_lists where group_id in (select public.my_group_ids()) and accepted_at is not null));
create policy shared_list_items_insert on public.shared_list_items for insert to authenticated
  with check (created_by = (select auth.uid()) and list_id in (select id from public.shared_lists where group_id in (select public.my_group_ids()) and accepted_at is not null));
create policy shared_list_items_update on public.shared_list_items for update to authenticated
  using (list_id in (select id from public.shared_lists where group_id in (select public.my_group_ids()) and accepted_at is not null))
  with check (list_id in (select id from public.shared_lists where group_id in (select public.my_group_ids()) and accepted_at is not null));
create policy shared_list_items_delete on public.shared_list_items for delete to authenticated using (created_by = (select auth.uid()));

-- ───────────── pairing functions ─────────────
create or replace function private.make_pair(a uuid, b uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  if exists (select 1 from public.group_members where user_id in (a, b) and left_at is null) then
    raise exception 'already_paired' using errcode = 'P0001';
  end if;
  insert into public.groups (kind) values ('pair') returning id into g;
  insert into public.group_members (group_id, user_id) values (g, a), (g, b);
  update public.partner_requests set status = 'cancelled', responded_at = now()
    where status = 'pending' and (from_user in (a, b) or to_user in (a, b));
  return g;
end $$;

-- Find someone by partner code: only their public name, never their data.
create or replace function public.find_partner_code(p_code text)
returns table (user_id uuid, username text, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.username::text, p.display_name from public.profiles p
  where p.partner_code = upper(trim(p_code)) and p.user_id <> (select auth.uid())
    and not exists (select 1 from public.blocks b where b.blocker = p.user_id and b.blocked = (select auth.uid()));
$$;

create or replace function public.request_partner(p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); them uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select user_id into them from public.find_partner_code(p_code);
  if them is null then return 'not_found'; end if; -- also returned when they blocked you
  if exists (select 1 from public.group_members where user_id = me and left_at is null) then return 'you_have_partner'; end if;
  if exists (select 1 from public.group_members where user_id = them and left_at is null) then return 'they_have_partner'; end if;
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

create or replace function public.respond_partner_request(p_id uuid, p_action text)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r public.partner_requests;
begin
  select * into r from public.partner_requests where id = p_id and to_user = me and status = 'pending' and expires_at > now();
  if r.id is null then return 'gone'; end if;
  if p_action = 'accept' then
    update public.partner_requests set status = 'accepted', responded_at = now() where id = p_id;
    perform private.make_pair(r.from_user, me);
    return 'paired';
  elsif p_action = 'block' then
    update public.partner_requests set status = 'declined', responded_at = now() where id = p_id;
    insert into public.blocks (blocker, blocked) values (me, r.from_user) on conflict do nothing;
    return 'blocked';
  else
    update public.partner_requests set status = 'declined', responded_at = now() where id = p_id;
    return 'declined';
  end if;
end $$;

create or replace function public.cancel_partner_request(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.partner_requests set status = 'cancelled', responded_at = now()
  where id = p_id and from_user = (select auth.uid()) and status = 'pending';
$$;

create or replace function public.create_invite_link()
returns text language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  delete from public.invite_links where from_user = auth.uid() and used_at is null;
  insert into public.invite_links (from_user) values (auth.uid()) returning token into t;
  return t;
end $$;

-- Who invited me (for the "Pair with @name?" screen) — only for a valid, unused link.
create or replace function public.peek_invite_link(p_token text)
returns table (username text, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.username::text, p.display_name from public.invite_links l join public.profiles p on p.user_id = l.from_user
  where l.token = p_token and l.used_at is null and l.expires_at > now() and l.from_user <> (select auth.uid());
$$;

create or replace function public.accept_invite_link(p_token text)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); l public.invite_links;
begin
  select * into l from public.invite_links where token = p_token and used_at is null and expires_at > now();
  if l.token is null or l.from_user = me then return 'invalid'; end if;
  if exists (select 1 from public.blocks where blocker = me and blocked = l.from_user) then return 'invalid'; end if;
  if exists (select 1 from public.group_members where user_id in (me, l.from_user) and left_at is null) then return 'already_paired'; end if;
  update public.invite_links set used_at = now(), used_by = me where token = p_token;
  perform private.make_pair(l.from_user, me);
  return 'paired';
end $$;

create or replace function public.regenerate_partner_code()
returns text language plpgsql security definer set search_path = '' as $$
declare c text := private.new_partner_code();
begin
  update public.profiles set partner_code = c where user_id = auth.uid();
  return c;
end $$;

create or replace function public.leave_partner()
returns void language plpgsql security definer set search_path = '' as $$
declare g uuid;
begin
  select group_id into g from public.group_members where user_id = auth.uid() and left_at is null limit 1;
  if g is null then return; end if;
  update public.group_members set left_at = now() where group_id = g and left_at is null;
  update public.session_invites set status = 'cancelled' where group_id = g and status in ('pending','snoozed','later');
  update public.co_sessions set status = 'ended', ended_at = now() where group_id = g and status <> 'ended';
end $$;

-- ───────────── what a partner may see (applies the sharing level) ─────────────
create or replace function public.partner_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  them uuid := public.my_partner();
  g uuid;
  s public.settings;
  p public.profiles;
  tz text; boundary int; today date; d_start timestamptz; d_end timestamptz; w_start date; w_from timestamptz; lw_from timestamptz;
  pres public.presence;
  snap jsonb;
begin
  if them is null then return null; end if;
  select group_id into g from public.group_members where user_id = them and left_at is null limit 1;
  select * into s from public.settings where owner_id = them;
  select * into p from public.profiles where user_id = them;
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
    'share_level', s.share_level, 'invites_mode', s.invites_mode, 'call_link', s.call_link, 'today', today,
    'presence', case when pres.user_id is null then null else jsonb_build_object(
      'status', case when pres.updated_at < now() - interval '90 seconds' then 'offline' else pres.status end,
      'focus_until', pres.focus_until, 'updated_at', pres.updated_at) end
  );
  if s.share_level = 'private' then return snap; end if;

  -- Today's commitments (private overrides never count)
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
  if s.share_level = 'exact' then
    snap := snap || jsonb_build_object(
      'tasks', coalesce((select jsonb_agg(jsonb_build_object('title', coalesce(t.first_action, t.title), 'done', t.status = 'done') order by t.status = 'done', t.sort_order)
                         from public.tasks t where t.owner_id = them and coalesce(t.share_override, 'exact') = 'exact'
                           and ((t.status in ('today','evening') and coalesce(t.planned_for, today) <= today) or (t.status = 'done' and t.completed_at >= d_start and t.completed_at < d_end))), '[]'::jsonb),
      'outcomes', coalesce((select jsonb_agg(jsonb_build_object('text', o.text, 'result', o.result) order by o.sort_order) from public.outcomes o where o.owner_id = them and o.week_start = w_start), '[]'::jsonb)
    );
  end if;
  return snap;
end $$;

-- Combined focus minutes this week for the shared quest (each person's own total is shared only as their level allows).
create or replace function public.pair_quest()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare g uuid; total int := 0; m record; target int;
begin
  select group_id into g from public.group_members where user_id = auth.uid() and left_at is null limit 1;
  if g is null then return null; end if;
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

-- ───────────── session invites ─────────────
create or replace function private.open_co_session(p_group uuid, p_minutes int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cs uuid;
begin
  update public.co_sessions set status = 'ended', ended_at = now() where group_id = p_group and status <> 'ended';
  insert into public.co_sessions (group_id, minutes) values (p_group, p_minutes) returning id into cs;
  insert into public.co_session_members (co_session_id, user_id)
    select cs, user_id from public.group_members where group_id = p_group and left_at is null;
  return cs;
end $$;

create or replace function public.send_session_invite(p_minutes int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); them uuid := public.my_partner(); g uuid; mode text; theirs public.session_invites; cs uuid; inv uuid;
begin
  if them is null then return jsonb_build_object('status', 'no_partner'); end if;
  select group_id into g from public.group_members where user_id = me and left_at is null limit 1;
  select invites_mode into mode from public.settings where owner_id = them;
  if mode = 'off' then return jsonb_build_object('status', 'off'); end if;
  if mode = 'online_only' and not exists (select 1 from public.presence where user_id = them and updated_at > now() - interval '90 seconds') then
    return jsonb_build_object('status', 'offline_only');
  end if;
  -- Both invited at once: join theirs.
  select * into theirs from public.session_invites where from_user = them and to_user = me and status in ('pending','snoozed','later') and expires_at > now()
    order by created_at desc limit 1;
  if theirs.id is not null then
    cs := private.open_co_session(g, theirs.minutes);
    update public.session_invites set status = 'accepted', responded_at = now(), co_session_id = cs where id = theirs.id;
    return jsonb_build_object('status', 'joined', 'co_session_id', cs);
  end if;
  if (select count(*) from public.session_invites where from_user = me and created_at > now() - interval '1 hour') >= 3 then
    return jsonb_build_object('status', 'limit');
  end if;
  update public.session_invites set status = 'cancelled' where from_user = me and status in ('pending','snoozed','later');
  insert into public.session_invites (group_id, from_user, to_user, minutes) values (g, me, them, greatest(10, least(120, p_minutes))) returning id into inv;
  return jsonb_build_object('status', 'sent', 'id', inv);
end $$;

create or replace function public.respond_session_invite(p_id uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); i public.session_invites; cs uuid;
begin
  select * into i from public.session_invites where id = p_id and to_user = me and status in ('pending','snoozed','later') and expires_at > now();
  if i.id is null then return jsonb_build_object('status', 'gone'); end if;
  if p_action = 'accept' then
    cs := private.open_co_session(i.group_id, i.minutes);
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

-- ───────────── pair session state machine ─────────────
create or replace function private.require_member(p_cs uuid)
returns public.co_sessions language plpgsql security definer set search_path = '' as $$
declare c public.co_sessions;
begin
  select cs.* into c from public.co_sessions cs join public.co_session_members m on m.co_session_id = cs.id
    where cs.id = p_cs and m.user_id = auth.uid() and m.left_at is null and cs.status <> 'ended'
      and cs.group_id in (select public.my_group_ids());
  if c.id is null then raise exception 'not_in_session' using errcode = 'P0001'; end if;
  return c;
end $$;

-- Ready: the last one to be ready starts the shared countdown (4 s).
create or replace function public.co_ready(p_cs uuid, p_goal text, p_task_title text, p_call text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare c public.co_sessions := private.require_member(p_cs); lvl text;
begin
  select share_level into lvl from public.settings where owner_id = auth.uid();
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

create or replace function public.co_finish(p_cs uuid, p_result text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.co_sessions := private.require_member(p_cs);
begin
  update public.co_session_members set result = p_result where co_session_id = p_cs and user_id = auth.uid();
  if c.status = 'running' and not exists (select 1 from public.co_session_members where co_session_id = p_cs and left_at is null and result is null) then
    update public.co_sessions set status = 'break', break_until = now() + interval '7 minutes' where id = p_cs and status = 'running';
  end if;
end $$;

create or replace function public.co_next_round(p_cs uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.co_sessions := private.require_member(p_cs);
begin
  update public.co_session_members set wants_next = true where co_session_id = p_cs and user_id = auth.uid();
  if not exists (select 1 from public.co_session_members where co_session_id = p_cs and left_at is null and not wants_next) then
    update public.co_session_members set ready = false, result = null, wants_next = false where co_session_id = p_cs;
    update public.co_sessions set status = 'checkin', round = round + 1, starts_at = null, break_until = null where id = p_cs;
  end if;
end $$;

create or replace function public.co_extend(p_cs uuid, p_minutes int)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.co_sessions := private.require_member(p_cs);
begin
  if c.status = 'running' then
    update public.co_sessions set minutes = least(120, minutes + greatest(1, least(15, p_minutes))) where id = p_cs;
  end if;
end $$;

create or replace function public.co_leave(p_cs uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.co_session_members set left_at = now() where co_session_id = p_cs and user_id = auth.uid() and left_at is null;
  if not exists (select 1 from public.co_session_members where co_session_id = p_cs and left_at is null) then
    update public.co_sessions set status = 'ended', ended_at = now() where id = p_cs;
  end if;
end $$;

create or replace function public.accept_shared_list(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.shared_lists set accepted_at = now()
  where id = p_id and accepted_at is null and created_by <> (select auth.uid()) and group_id in (select public.my_group_ids());
$$;

-- Server-only functions are callable by signed-in users; private helpers are not.
revoke all on function private.new_partner_code(), private.make_pair(uuid, uuid), private.open_co_session(uuid, int), private.require_member(uuid) from public, anon, authenticated;
revoke execute on function public.find_partner_code(text), public.request_partner(text), public.respond_partner_request(uuid, text),
  public.cancel_partner_request(uuid), public.create_invite_link(), public.peek_invite_link(text), public.accept_invite_link(text),
  public.regenerate_partner_code(), public.leave_partner(), public.partner_snapshot(), public.pair_quest(),
  public.send_session_invite(int), public.respond_session_invite(uuid, text), public.co_ready(uuid, text, text, text),
  public.co_finish(uuid, text), public.co_next_round(uuid), public.co_extend(uuid, int), public.co_leave(uuid), public.accept_shared_list(uuid),
  public.my_group_ids(), public.is_partner(uuid), public.my_partner(), public.shows_presence(uuid)
  from public, anon;

-- Your own week vs last week (progress against yourself, never a ranking).
create or replace function public.partner_week_self()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); p public.profiles; today date; w_start date; w_from timestamptz; lw_from timestamptz;
begin
  select * into p from public.profiles where user_id = me;
  if p.user_id is null then return null; end if;
  today := ((now() at time zone p.timezone) - make_interval(hours => p.day_boundary_hour))::date;
  w_start := today - ((extract(isodow from today)::int) - 1);
  w_from := (w_start::timestamp + make_interval(hours => p.day_boundary_hour)) at time zone p.timezone;
  lw_from := w_from - interval '7 days';
  return jsonb_build_object(
    'focus_week', (select coalesce(sum(active_seconds), 0) / 60 from public.sessions where owner_id = me and started_at >= w_from and ended_at is not null),
    'focus_last_week', (select coalesce(sum(active_seconds), 0) / 60 from public.sessions where owner_id = me and started_at >= lw_from and started_at < w_from and ended_at is not null),
    'outcomes_week', (select count(*) from public.outcomes where owner_id = me and week_start = w_start),
    'outcomes_met', (select count(*) from public.outcomes where owner_id = me and week_start = w_start and result = 'met'));
end $$;

-- Pending requests with the other person's public name only.
create or replace function public.pending_partner_requests()
returns table (id uuid, incoming boolean, username text, display_name text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.to_user = (select auth.uid()), p.username::text, p.display_name, r.created_at
  from public.partner_requests r
  join public.profiles p on p.user_id = case when r.to_user = (select auth.uid()) then r.from_user else r.to_user end
  where r.status = 'pending' and r.expires_at > now() and (r.to_user = (select auth.uid()) or r.from_user = (select auth.uid()))
  order by r.created_at desc;
$$;

revoke execute on function public.partner_week_self(), public.pending_partner_requests() from public, anon;

-- Heartbeat with the server clock (devices disagree about time; the server doesn't).
create or replace function public.beat(p_status text, p_focus_until timestamptz)
returns void language sql security definer set search_path = '' as $$
  insert into public.presence (user_id, status, focus_until, updated_at)
  values ((select auth.uid()), case when p_status in ('online','focus','break') then p_status else 'online' end, p_focus_until, now())
  on conflict (user_id) do update set status = excluded.status, focus_until = excluded.focus_until, updated_at = now();
$$;
revoke execute on function public.beat(text, timestamptz) from public, anon;
