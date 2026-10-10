-- M2: goals, calendar, commitment ledger, push subscriptions (DESIGN §9, §10)

alter table public.settings
  add column day_start_hour smallint not null default 7 check (day_start_hour between 0 and 23),
  add column day_end_hour smallint not null default 22 check (day_end_hour between 1 and 24),
  add column quiet_start_hour smallint not null default 22 check (quiet_start_hour between 0 and 23),
  add column quiet_end_hour smallint not null default 7 check (quiet_end_hour between 0 and 23),
  add column push_enabled boolean not null default false,
  add column ics_url text check (ics_url is null or ics_url ~ '^https://'),
  add column ics_fetched_at timestamptz,
  add column setup_checklist jsonb not null default '["Phone in another room","Notifications off","Water nearby","Materials open"]'::jsonb;

-- ───────────── goals ─────────────
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  type text not null check (type in ('outcome','learning','process')),
  target_text text not null check (char_length(target_text) between 1 and 200),
  target_value numeric,
  current_value numeric not null default 0,
  target_unit text check (char_length(target_unit) <= 30),
  deadline date,
  weekly_commitment_minutes integer not null default 0 check (weekly_commitment_minutes between 0 and 6000),
  why_text text check (char_length(why_text) <= 300),
  woop_obstacle text check (char_length(woop_obstacle) <= 300),
  woop_if_then text check (char_length(woop_if_then) <= 300),
  status text not null default 'draft' check (status in ('draft','active','paused','done','dropped')),
  activated_at timestamptz,
  resolved_at timestamptz,
  visibility text not null default 'private' check (visibility in ('private','shared')),
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  check (type = 'process' or deadline is not null),
  check (status <> 'active' or (woop_obstacle is not null and woop_if_then is not null))
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null,
  title text not null check (char_length(title) between 1 and 120),
  due_date date,
  done_at timestamptz,
  sort_order integer not null default 0,
  foreign key (goal_id, owner_id) references public.goals (id, owner_id) on delete cascade
);

create table public.goal_projects (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null,
  project_id uuid not null,
  primary key (goal_id, project_id),
  foreign key (goal_id, owner_id) references public.goals (id, owner_id) on delete cascade,
  foreign key (project_id, owner_id) references public.projects (id, owner_id) on delete cascade
);

-- ───────────── calendar ─────────────
create table public.block_series (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('focus','speaking','ritual','buffer','recovery')),
  title text not null check (char_length(title) between 1 and 120),
  task_id uuid,
  goal_id uuid,
  weekdays smallint[] not null check (array_length(weekdays, 1) between 1 and 7),
  start_minute integer not null check (start_minute between 0 and 1439),
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  timer_mode text check (timer_mode in ('ladder','blind','starter','timebox','free')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (task_id, owner_id) references public.tasks (id, owner_id) on delete set null (task_id),
  foreign key (goal_id, owner_id) references public.goals (id, owner_id) on delete set null (goal_id)
);

create table public.calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('focus','speaking','ritual','buffer','recovery','fixed')),
  title text not null check (char_length(title) between 1 and 200),
  task_id uuid,
  goal_id uuid,
  series_id uuid,
  start_at timestamptz not null,
  end_at timestamptz not null,
  timer_mode text check (timer_mode in ('ladder','blind','starter','timebox','free')),
  if_then_text text check (char_length(if_then_text) <= 200),
  external_uid text,
  status text not null default 'planned' check (status in ('planned','committed','cancelled')),
  cancel_reason text check (char_length(cancel_reason) <= 200),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_at > start_at),
  unique (id, owner_id),
  unique (series_id, start_at),
  unique (owner_id, external_uid, start_at),
  foreign key (task_id, owner_id) references public.tasks (id, owner_id) on delete set null (task_id),
  foreign key (goal_id, owner_id) references public.goals (id, owner_id) on delete set null (goal_id),
  foreign key (series_id, owner_id) references public.block_series (id, owner_id) on delete set null (series_id)
);
create index calendar_blocks_owner_start_idx on public.calendar_blocks (owner_id, start_at);

alter table public.sessions add column block_id uuid;
alter table public.sessions add foreign key (block_id, owner_id)
  references public.calendar_blocks (id, owner_id) on delete set null (block_id);
create index sessions_block_idx on public.sessions (block_id);

-- ───────────── commitment ledger (frozen snapshots; revisions are append-only) ─────────────
create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  level text not null check (level in ('block','week_goal','goal')),
  block_id uuid,
  goal_id uuid,
  week_start date,
  committed_start timestamptz,
  committed_minutes integer not null check (committed_minutes >= 0),
  snapshot jsonb not null default '{}'::jsonb,
  committed_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (block_id),
  unique (owner_id, level, goal_id, week_start),
  foreign key (block_id, owner_id) references public.calendar_blocks (id, owner_id) on delete cascade,
  foreign key (goal_id, owner_id) references public.goals (id, owner_id) on delete cascade
);

create table public.commitment_revisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  commitment_id uuid not null,
  change text not null check (change in ('moved','shortened','extended','released','cancelled_late')),
  new_start timestamptz,
  new_minutes integer,
  reason text check (char_length(reason) <= 200),
  revised_at timestamptz not null default now(),
  foreign key (commitment_id, owner_id) references public.commitments (id, owner_id) on delete cascade
);
create index commitment_revisions_commitment_idx on public.commitment_revisions (commitment_id);

create table public.block_outcomes (
  block_id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  outcome text not null check (outcome in ('kept','shortened','moved','released','missed')),
  actual_minutes integer not null default 0,
  minutes_late integer,
  score numeric(4,3),
  auto boolean not null default true,
  assigned_at timestamptz not null default now(),
  foreign key (block_id, owner_id) references public.calendar_blocks (id, owner_id) on delete cascade
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ───────────── RLS ─────────────
alter table public.goals enable row level security;
alter table public.milestones enable row level security;
alter table public.goal_projects enable row level security;
alter table public.block_series enable row level security;
alter table public.calendar_blocks enable row level security;
alter table public.commitments enable row level security;
alter table public.commitment_revisions enable row level security;
alter table public.block_outcomes enable row level security;
alter table public.push_subscriptions enable row level security;

create policy goals_select on public.goals for select to authenticated using (public.can_read(owner_id, 'goal', id));
create policy calendar_blocks_select on public.calendar_blocks for select to authenticated using (public.can_read(owner_id, 'block', id));

do $$
declare t text;
begin
  foreach t in array array['milestones','goal_projects','block_series','block_outcomes','push_subscriptions','commitments','commitment_revisions'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (owner_id = (select auth.uid()))', t);
  end loop;
  foreach t in array array['goals','milestones','goal_projects','block_series','calendar_blocks','block_outcomes','push_subscriptions','commitments','commitment_revisions'] loop
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (owner_id = (select auth.uid()))', t);
  end loop;
  -- commitments and revisions are immutable: no update/delete policies
  foreach t in array array['goals','milestones','goal_projects','block_series','calendar_blocks','block_outcomes','push_subscriptions'] loop
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (owner_id = (select auth.uid()))', t);
  end loop;
end $$;
revoke update, delete on public.commitments, public.commitment_revisions from authenticated;

-- ───────────── scheduler: pg_cron → pg_net → app dispatch endpoint (no Edge runtime needed) ─────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.app_config (key text primary key, value text not null);

create or replace function private.dispatch_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text;
begin
  select value into v_url from private.app_config where key = 'dispatch_url';
  select value into v_secret from private.app_config where key = 'cron_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end $$;

select cron.schedule('plan-dispatch', '* * * * *', $$select private.dispatch_tick()$$);
