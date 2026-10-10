-- General setup: what you're working on (sets examples and wording) and a daily focus target (the Today dial).

alter table public.settings
  add column work_kind text check (work_kind in ('exam', 'skill', 'work', 'creative', 'habits')),
  add column daily_focus_minutes smallint check (daily_focus_minutes between 10 and 720);

-- Built-in speaking prompts: general study and skill prompts instead of one exam-specific interview question.
update public.speaking_prompts set text = 'Why are you learning what you are learning right now?'
  where owner_id is null and text = 'Why do you want to do an MBA now?';
insert into public.speaking_prompts (owner_id, drill_type, category, text, framework) values
  (null, 'explain', 'learning', 'Explain the main idea of what you studied today, as if to a classmate who missed it.', null),
  (null, 'explain', 'learning', 'Teach the hardest step of a skill you are practising, one step at a time.', null),
  (null, 'summarize', 'reading', 'Summarise one chapter or lesson: the big idea, two details, one question you still have.', null);
