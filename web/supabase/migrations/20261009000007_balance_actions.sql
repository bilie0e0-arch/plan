-- Balance & action pass: hide-until dates, training emphasis, onboarding flag, DND in the launcher checklist

-- "Hide until…" (Things-style start date): the task stays out of lists until that day.
alter table public.tasks add column hidden_until date;
create index tasks_owner_hidden_idx on public.tasks (owner_id, hidden_until) where hidden_until is not null;

-- What the user wants to get better at. Sets emphasis (what the Guide suggests first), never visibility.
alter table public.settings
  add column focus_areas text[] not null default '{}'
    check (focus_areas <@ array['focus','planning','speaking','habits']::text[]),
  add column onboarded_at timestamptz;

-- Launcher checklist: the phone goes on Do Not Disturb (a web app can't block other apps; the OS can).
alter table public.settings alter column setup_checklist
  set default '["Phone on Do Not Disturb","Phone out of reach","Water nearby","Materials open"]'::jsonb;
update public.settings
  set setup_checklist = '["Phone on Do Not Disturb","Phone out of reach","Water nearby","Materials open"]'::jsonb
  where setup_checklist = '["Phone in another room","Notifications off","Water nearby","Materials open"]'::jsonb;
