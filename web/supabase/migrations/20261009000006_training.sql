-- M3: training loop & fun (DESIGN §5.3–5.4, §9.5, §10.11, §11.7–11.9, §13.10–13.12, §13.20)

-- ───────────── task behaviour fields: definition of done + if-then cue (F17, F57) ─────────────
alter table public.tasks
  add column done_when text check (char_length(done_when) <= 200),
  add column if_then_trigger text check (char_length(if_then_trigger) <= 200),
  add column if_then_minute smallint check (if_then_minute between 0 and 1439);

-- ───────────── settings: aging threshold, personal band anchors (re-anchoring after 8 weeks) ─────────────
alter table public.settings
  add column aging_days smallint not null default 14 check (aging_days between 7 and 60),
  add column personal_bands boolean not null default true,
  add column skill_anchors jsonb,
  add column anchored_at timestamptz;

-- ───────────── daily reflection (one rotating question at shutdown) ─────────────
alter table public.day_plans
  add column reflection_question text check (char_length(reflection_question) <= 200),
  add column reflection_text text check (char_length(reflection_text) <= 500);

-- ───────────── speaking prosody (computed in the browser from the audio) ─────────────
alter table public.recordings
  add column pitch_var numeric(5,2) check (pitch_var between 0 and 99),
  add column volume_var numeric(5,2) check (volume_var between 0 and 99);

-- ───────────── weekly review (one per planned week) ─────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  step smallint not null default 1 check (step between 1 and 9),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, week_start),
  check (extract(isodow from week_start) = 1)
);

-- ───────────── weekly outcomes: 3 per week, graded at the next review ─────────────
create table public.outcomes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  text text not null check (char_length(text) between 1 and 200),
  sort_order smallint not null default 0 check (sort_order between 0 and 2),
  result text check (result in ('met','partial','missed')),
  graded_at timestamptz,
  visibility text not null default 'private' check (visibility in ('private','shared')),
  created_at timestamptz not null default now(),
  unique (owner_id, week_start, sort_order)
);

-- ───────────── missions: one main (the weekly drill) + one optional side ─────────────
create table public.missions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  kind text not null check (kind in ('main','side')),
  skill text not null check (skill in ('S1','S2','S3','S4','S5','S6','S7','S8')),
  title text not null check (char_length(title) between 1 and 120),
  target smallint not null check (target between 1 and 100),
  result_before numeric,
  result_after numeric,
  progress smallint,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, week_start, kind)
);

-- ───────────── personal records (best value per record type) ─────────────
create table public.personal_records (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  record_type text not null check (record_type in ('longest_clean_session','most_focus_day','lowest_filler_rate','best_kept_week')),
  value numeric not null,
  previous_value numeric,
  achieved_at timestamptz not null,
  ref_id uuid,
  seen_at timestamptz,
  primary key (owner_id, record_type)
);

-- ───────────── habits: consistency, never miss twice (no streaks) ─────────────
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  weekdays smallint[] not null default array[0,1,2,3,4,5,6]::smallint[]
    check (array_length(weekdays, 1) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.habit_logs (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null,
  day date not null,
  primary key (habit_id, day),
  foreign key (habit_id, owner_id) references public.habits (id, owner_id) on delete cascade
);

-- ───────────── goal confidence forecasts (weekly; resolved against delivered hours → Brier) ─────────────
create table public.goal_confidence (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null,
  week_start date not null check (extract(isodow from week_start) = 1),
  confidence_pct smallint not null check (confidence_pct between 0 and 100),
  created_at timestamptz not null default now(),
  primary key (goal_id, week_start),
  foreign key (goal_id, owner_id) references public.goals (id, owner_id) on delete cascade
);

-- ───────────── RLS: owner-only ─────────────
alter table public.reviews enable row level security;
alter table public.outcomes enable row level security;
alter table public.missions enable row level security;
alter table public.personal_records enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.goal_confidence enable row level security;

create policy outcomes_select on public.outcomes for select to authenticated using (public.can_read(owner_id, 'outcome', id));

do $$
declare t text;
begin
  foreach t in array array['reviews','missions','personal_records','habits','habit_logs','goal_confidence'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (owner_id = (select auth.uid()))', t);
  end loop;
  foreach t in array array['reviews','outcomes','missions','personal_records','habits','habit_logs','goal_confidence'] loop
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (owner_id = (select auth.uid()))', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (owner_id = (select auth.uid()))', t);
  end loop;
end $$;

create index tasks_owner_touched_idx on public.tasks (owner_id, last_touched_at);
create index habit_logs_owner_day_idx on public.habit_logs (owner_id, day);
