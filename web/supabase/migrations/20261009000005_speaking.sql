-- M2: Speaking Studio (DESIGN §7). Transcription uses the browser's free speech recognition.

alter table public.settings
  add column filler_words text[] not null default array['um','uh','like','basically','actually','you know','sort of','kind of','i mean','right','so','literally'],
  add column audio_retention_days integer check (audio_retention_days is null or audio_retention_days between 7 and 3650);

create table public.speaking_prompts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid default auth.uid() references auth.users (id) on delete cascade, -- null = built-in
  drill_type text not null check (drill_type in ('impromptu','structured','explain','summarize','rehearsal')),
  category text not null default 'general' check (char_length(category) <= 30),
  text text not null check (char_length(text) between 3 and 2000),
  framework text check (framework in ('prep','star')),
  project_id uuid references public.projects (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prompt_id uuid references public.speaking_prompts (id) on delete set null,
  prompt_text text not null check (char_length(prompt_text) <= 2000),
  drill_type text not null check (drill_type in ('impromptu','structured','explain','summarize','rehearsal')),
  framework text check (framework in ('prep','star')),
  task_id uuid,
  block_id uuid,
  take_number smallint not null default 1 check (take_number between 1 and 5),
  parent_recording_id uuid references public.recordings (id) on delete set null,
  target_seconds integer not null check (target_seconds between 15 and 1800),
  duration_seconds integer not null check (duration_seconds between 1 and 3600),
  speaking_seconds integer,
  audio_path text,
  audio_deleted_at timestamptz,
  transcript text,
  transcript_segments jsonb not null default '[]'::jsonb,
  word_count integer,
  wpm integer,
  filler_count integer,
  fillers_per_min numeric(5,2),
  filler_breakdown jsonb not null default '{}'::jsonb,
  long_pause_count integer,
  hedges_per_min numeric(5,2),
  repeats integer,
  vocab_variety numeric(4,3),
  time_on_target boolean,
  clarity smallint check (clarity between 1 and 5),
  structure smallint check (structure between 1 and 5),
  confidence smallint check (confidence between 1 and 5),
  conciseness smallint check (conciseness between 1 and 5),
  engagement smallint check (engagement between 1 and 5),
  guessed_fillers integer check (guessed_fillers between 0 and 999),
  one_fix text check (char_length(one_fix) <= 200),
  listened boolean not null default false,
  is_milestone boolean not null default false,
  is_baseline boolean not null default false,
  visibility text not null default 'private' check (visibility in ('private','shared')),
  recorded_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (task_id, owner_id) references public.tasks (id, owner_id) on delete set null (task_id),
  foreign key (block_id, owner_id) references public.calendar_blocks (id, owner_id) on delete set null (block_id),
  check (clarity is null or listened)
);
create index recordings_owner_recorded_idx on public.recordings (owner_id, recorded_at desc);

alter table public.speaking_prompts enable row level security;
alter table public.recordings enable row level security;

create policy speaking_prompts_select on public.speaking_prompts for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
create policy speaking_prompts_insert on public.speaking_prompts for insert to authenticated with check (owner_id = (select auth.uid()));
create policy speaking_prompts_update on public.speaking_prompts for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy speaking_prompts_delete on public.speaking_prompts for delete to authenticated using (owner_id = (select auth.uid()));

create policy recordings_select on public.recordings for select to authenticated using (public.can_read(owner_id, 'recording', id));
create policy recordings_insert on public.recordings for insert to authenticated with check (owner_id = (select auth.uid()));
create policy recordings_update on public.recordings for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy recordings_delete on public.recordings for delete to authenticated using (owner_id = (select auth.uid()));

-- Private audio bucket; each user can only touch files under their own user-id folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 10485760, array['audio/webm','audio/ogg','audio/mp4','audio/mpeg'])
on conflict (id) do nothing;

create policy recordings_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy recordings_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy recordings_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Built-in prompt bank
insert into public.speaking_prompts (owner_id, drill_type, category, text, framework) values
  (null, 'impromptu', 'opinion', 'Describe a decision you changed your mind on, and why.', null),
  (null, 'impromptu', 'opinion', 'What is one habit most people underrate?', null),
  (null, 'impromptu', 'story', 'Tell me about a time something went wrong and what you did next.', null),
  (null, 'impromptu', 'opinion', 'Should people specialise early or stay broad? Pick a side.', null),
  (null, 'impromptu', 'work', 'Explain what you worked on yesterday to someone outside your field.', null),
  (null, 'impromptu', 'opinion', 'What is the best advice you have ignored?', null),
  (null, 'impromptu', 'persuasion', 'Convince me to try something you enjoy.', null),
  (null, 'impromptu', 'story', 'Describe a person who changed how you think.', null),
  (null, 'structured', 'interview', 'Tell me about yourself.', 'prep'),
  (null, 'structured', 'interview', 'Why do you want to do an MBA now?', 'prep'),
  (null, 'structured', 'interview', 'Describe a time you led a team through a difficult situation.', 'star'),
  (null, 'structured', 'interview', 'Tell me about a failure and what you learned.', 'star'),
  (null, 'structured', 'interview', 'Describe a time you had to influence someone without authority.', 'star'),
  (null, 'structured', 'interview', 'What would your colleagues say is your biggest weakness?', 'prep'),
  (null, 'structured', 'work', 'Give a 90-second update on your most important project.', 'prep'),
  (null, 'explain', 'learning', 'Explain an idea you learned this week as if to a smart beginner.', null),
  (null, 'explain', 'learning', 'Explain how compound interest works.', null),
  (null, 'explain', 'learning', 'Explain what an assumption is in an argument, with an example.', null),
  (null, 'explain', 'learning', 'Explain the difference between correlation and causation.', null),
  (null, 'explain', 'work', 'Explain your job to a 12-year-old.', null),
  (null, 'summarize', 'reading', 'Summarise the last article or chapter you read in one minute.', null),
  (null, 'summarize', 'reading', 'Summarise a meeting or conversation from today: decision, reasons, next step.', null),
  (null, 'rehearsal', 'work', 'Rehearse a talk, pitch or update you have coming up.', null);
