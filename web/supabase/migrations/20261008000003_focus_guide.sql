-- Daily loop, focus sessions, ladder, guide events
create table public.day_plans (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  energy smallint check (energy between 1 and 5),
  sleep_hours numeric(3,1) check (sleep_hours between 0 and 24),
  available_minutes integer check (available_minutes between 0 and 1440),
  planned_minutes integer,
  multiplier_used numeric(4,2),
  planned_task_count integer,
  done_task_count integer,
  completion_rate numeric(4,3),
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (owner_id, day)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null,
  mode text not null check (mode in ('ladder','blind','starter','timebox','free')),
  suggested_mode text check (suggested_mode in ('ladder','blind','starter','timebox','free')),
  goal_text text check (char_length(goal_text) <= 200),
  predicted_minutes integer check (predicted_minutes between 1 and 1440),
  planned_minutes integer check (planned_minutes between 1 and 1440),
  ladder_rung smallint,
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  paused_seconds integer not null default 0,
  ended_at timestamptz,
  active_seconds integer,
  outcome text check (outcome in ('completed','stopped_early','abandoned')),
  goal_met text check (goal_met in ('yes','partial','no')),
  quality smallint check (quality between 1 and 5),
  is_clean boolean,
  overran boolean not null default false,
  reentry_note text check (char_length(reentry_note) <= 300),
  visibility text not null default 'private' check (visibility in ('private','shared')),
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (task_id, owner_id) references public.tasks (id, owner_id) on delete cascade
);
create index sessions_owner_started_idx on public.sessions (owner_id, started_at desc);
create index sessions_task_idx on public.sessions (task_id);
-- at most one open session per user
create unique index sessions_one_open_per_owner on public.sessions (owner_id) where ended_at is null;

create table public.distractions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null,
  kind text not null check (kind in ('internal','external')),
  note text check (char_length(note) <= 80),
  at timestamptz not null default now(),
  foreign key (session_id, owner_id) references public.sessions (id, owner_id) on delete cascade
);
create index distractions_session_idx on public.distractions (session_id);
create index distractions_owner_at_idx on public.distractions (owner_id, at desc);

create table public.breaks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  after_session_id uuid not null,
  suggested_minutes integer not null check (suggested_minutes between 1 and 60),
  taken boolean not null,
  created_at timestamptz not null default now(),
  foreign key (after_session_id, owner_id) references public.sessions (id, owner_id) on delete cascade
);

create table public.ladder_state (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  current_rung smallint not null default 25,
  clean_count smallint not null default 0,
  consecutive_misses smallint not null default 0,
  suggest_down boolean not null default false,
  calibrated boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.guide_prompts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null,
  shown_on date not null,
  outcome text not null default 'shown' check (outcome in ('shown','acted','dismissed')),
  shown_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (owner_id, type, shown_on)
);

create table public.decision_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area text not null check (area in ('next_task','timer_mode')),
  source text not null check (source in ('self','suggestion_accepted','suggestion_modified')),
  at timestamptz not null default now()
);
create index decision_events_owner_at_idx on public.decision_events (owner_id, at desc);

-- Actual minutes per task (respects RLS of the caller)
create view public.task_actuals with (security_invoker = true) as
  select task_id, owner_id, coalesce(sum(active_seconds), 0)::integer as actual_seconds, count(*)::integer as session_count
  from public.sessions
  where ended_at is not null
  group by task_id, owner_id;

-- New users also get a ladder state
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, username, timezone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    coalesce(nullif(new.raw_user_meta_data ->> 'timezone', ''), 'UTC')
  );
  insert into public.settings (owner_id) values (new.id);
  insert into public.ladder_state (owner_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── RLS (owner-only writes, reads via can_read) ─────────────
alter table public.day_plans enable row level security;
alter table public.sessions enable row level security;
alter table public.distractions enable row level security;
alter table public.breaks enable row level security;
alter table public.ladder_state enable row level security;
alter table public.guide_prompts enable row level security;
alter table public.decision_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['day_plans','distractions','breaks','ladder_state','guide_prompts','decision_events'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (owner_id = (select auth.uid()))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (owner_id = (select auth.uid()))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

create policy sessions_select on public.sessions for select to authenticated
  using (public.can_read(owner_id, 'session', id));
create policy sessions_insert on public.sessions for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy sessions_update on public.sessions for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy sessions_delete on public.sessions for delete to authenticated
  using (owner_id = (select auth.uid()));
