-- M2 security: goals, calendar, frozen commitments, recordings, audio storage folders
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test.dev', '{"username":"alice"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@test.dev',   '{"username":"bob"}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

insert into public.goals (id, title, type, target_text, weekly_commitment_minutes) values
  ('40000000-0000-0000-0000-000000000001', 'Write weekly', 'process', '4 h / week', 240);
select throws_ok($$update public.goals set status = 'active' where id = '40000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'a goal cannot be activated without WOOP obstacle + if-then');
insert into public.calendar_blocks (id, type, title, goal_id, start_at, end_at) values
  ('50000000-0000-0000-0000-000000000001', 'focus', 'Writing', '40000000-0000-0000-0000-000000000001', now() + interval '1 day', now() + interval '1 day 1 hour');
insert into public.commitments (id, level, block_id, committed_start, committed_minutes) values
  ('60000000-0000-0000-0000-000000000001', 'block', '50000000-0000-0000-0000-000000000001', now() + interval '1 day', 60);

-- Frozen commitments: updates/deletes are silently impossible (no policy, no grant)
select throws_ok($$update public.commitments set committed_minutes = 5$$, '42501', null, 'commitments cannot be edited');
select throws_ok($$delete from public.commitments$$, '42501', null, 'commitments cannot be deleted');
insert into public.commitment_revisions (commitment_id, change, new_minutes) values ('60000000-0000-0000-0000-000000000001', 'shortened', 45);
select is((select committed_minutes from public.commitments), 60, 'original commitment stays intact after a revision');

insert into public.recordings (id, prompt_text, drill_type, target_seconds, duration_seconds) values
  ('70000000-0000-0000-0000-000000000001', 'Tell me about yourself.', 'structured', 90, 88);
select throws_ok($$update public.recordings set clarity = 4 where id = '70000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'cannot rate a recording before listening back');
insert into public.speaking_prompts (drill_type, text) values ('impromptu', 'Alice private prompt');
select ok((select count(*) from public.speaking_prompts where owner_id is null) > 10, 'built-in prompts are visible');

-- Storage: own folder ok, other folder blocked
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('recordings', '00000000-0000-0000-0000-0000000000a1/x.webm', '00000000-0000-0000-0000-0000000000a1')$$,
  'alice can write to her own audio folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('recordings', '00000000-0000-0000-0000-0000000000b2/x.webm')$$,
  '42501', null, 'alice cannot write into bob''s audio folder');

-- Bob sees nothing of alice's
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select is((select count(*)::int from public.goals), 0, 'bob sees no goals of alice');
select is((select count(*)::int from public.calendar_blocks), 0, 'bob sees no blocks of alice');
select is((select count(*)::int from public.commitments), 0, 'bob sees no commitments of alice');
select is((select count(*)::int from public.recordings), 0, 'bob sees no recordings of alice');
select is((select count(*)::int from public.speaking_prompts where owner_id is not null), 0, 'bob cannot see alice''s custom prompts');
select is((select count(*)::int from storage.objects where bucket_id = 'recordings'), 0, 'bob cannot list alice''s audio');

select * from finish();
rollback;
