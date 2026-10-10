-- Calendar subjects: a block (and a repeating series) can belong to a project, which gives it its colour
-- even without a task or goal ("Biology 4–6pm").

alter table public.calendar_blocks
  add column project_id uuid,
  add constraint calendar_blocks_project_fk foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete set null (project_id);

alter table public.block_series
  add column project_id uuid,
  add constraint block_series_project_fk foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete set null (project_id);

create index calendar_blocks_project_idx on public.calendar_blocks (project_id) where project_id is not null;
