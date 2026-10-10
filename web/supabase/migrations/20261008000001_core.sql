-- Core: profiles, settings, access function, projects, tasks
create extension if not exists citext with schema extensions;

-- ───────────── profiles & settings ─────────────
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique
    check (username::text ~ '^[a-z0-9_]{3,20}$')
    check (username::text not in ('admin','root','support','api','www','help','system','plan')),
  display_name text check (char_length(display_name) <= 60),
  timezone text not null default 'UTC',
  day_boundary_hour smallint not null default 4 check (day_boundary_hour between 0 and 23),
  created_at timestamptz not null default now()
);

create table public.settings (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  wip_cap smallint not null default 7 check (wip_cap between 3 and 9),
  active_project_cap smallint not null default 5 check (active_project_cap between 3 and 7),
  default_available_minutes integer not null default 360 check (default_available_minutes between 30 and 960),
  coach_tone text not null default 'calm' check (coach_tone in ('calm','direct','playful')),
  daily_prompt_budget smallint not null default 6 check (daily_prompt_budget between 0 and 10),
  guide_overrides jsonb not null default '{}'::jsonb,
  sound_enabled boolean not null default true,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  created_at timestamptz not null default now()
);

-- ───────────── access function (single point; Phase 7 adds shares/groups) ─────────────
create or replace function public.can_read(p_owner_id uuid, p_resource_type text, p_resource_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_owner_id = (select auth.uid());
$$;

-- ───────────── projects ─────────────
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name extensions.citext not null check (char_length(name::text) between 1 and 40),
  color text not null default 'slate'
    check (color in ('slate','teal','blue','violet','rose','amber','green','stone')),
  status text not null default 'active' check (status in ('active','paused','done')),
  weekly_budget_minutes integer not null default 0 check (weekly_budget_minutes between 0 and 10080),
  visibility text not null default 'private' check (visibility in ('private','shared')),
  created_at timestamptz not null default now(),
  unique (owner_id, name),
  unique (id, owner_id)
);
create index projects_owner_idx on public.projects (owner_id);

-- ───────────── tasks ─────────────
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid,
  title text not null check (char_length(title) between 1 and 500),
  first_action text check (char_length(first_action) <= 200),
  status text not null default 'inbox'
    check (status in ('inbox','today','evening','backlog','someday','done','killed')),
  kind text not null default 'work' check (kind in ('work','speak')),
  source text not null default 'capture' check (source in ('capture','parked')),
  estimate_minutes integer check (estimate_minutes between 1 and 1440),
  energy text check (energy in ('deep','shallow','admin')),
  planned_for date,
  sort_order integer not null default 0,
  deferral_count integer not null default 0,
  first_planned_at timestamptz,
  first_started_at timestamptz,
  reentry_note text check (char_length(reentry_note) <= 300),
  completed_at timestamptz,
  killed_at timestamptz,
  visibility text not null default 'private' check (visibility in ('private','shared')),
  last_touched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  -- a task can only reference a project owned by the same user
  foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete set null (project_id)
);
create index tasks_owner_status_idx on public.tasks (owner_id, status, sort_order);
create index tasks_owner_planned_idx on public.tasks (owner_id, planned_for);

-- ───────────── RLS ─────────────
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- username is permanent; only these columns are user-editable
revoke update on public.profiles from authenticated;
grant update (display_name, timezone, day_boundary_hour) on public.profiles to authenticated;

create policy settings_select_own on public.settings
  for select to authenticated using (owner_id = (select auth.uid()));
create policy settings_update_own on public.settings
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy projects_select on public.projects for select to authenticated
  using (public.can_read(owner_id, 'project', id));
create policy projects_insert on public.projects for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy projects_update on public.projects for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy projects_delete on public.projects for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy tasks_select on public.tasks for select to authenticated
  using (public.can_read(owner_id, 'task', id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy tasks_update on public.tasks for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy tasks_delete on public.tasks for delete to authenticated
  using (owner_id = (select auth.uid()));
