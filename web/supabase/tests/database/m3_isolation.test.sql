-- M3 security: reviews, outcomes, missions, records, habits, goal forecasts are private to their owner
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test.dev', '{"username":"alice"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@test.dev',   '{"username":"bob"}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

insert into public.reviews (week_start) values ('2026-10-12');
insert into public.outcomes (week_start, text, sort_order) values ('2026-10-12', 'Chapter 3 drafted', 0);
insert into public.missions (week_start, kind, skill, title, target) values ('2026-10-12', 'main', 'S3', 'Do 10 blind estimates', 10);
insert into public.personal_records (record_type, value, achieved_at) values ('longest_clean_session', 55, now());
insert into public.habits (id, name) values ('80000000-0000-0000-0000-000000000001', 'Read 10 min');
insert into public.habit_logs (habit_id, day) values ('80000000-0000-0000-0000-000000000001', '2026-10-12');
insert into public.goals (id, title, type, target_text, weekly_commitment_minutes) values
  ('40000000-0000-0000-0000-000000000009', 'Write weekly', 'process', '4 h / week', 240);
insert into public.goal_confidence (goal_id, week_start, confidence_pct) values ('40000000-0000-0000-0000-000000000009', '2026-10-12', 70);

-- Integrity rules
select throws_ok($$insert into public.reviews (week_start) values ('2026-10-14')$$, '23514', null, 'a review week must start on a Monday');
select throws_ok($$insert into public.outcomes (week_start, text, sort_order) values ('2026-10-12', 'Fourth', 3)$$, '23514', null, 'at most three outcomes per week');
select throws_ok($$insert into public.missions (week_start, kind, skill, title, target) values ('2026-10-12', 'main', 'S1', 'Again', 5)$$, '23505', null, 'one main mission per week');
select throws_ok($$insert into public.goal_confidence (goal_id, week_start, confidence_pct) values ('40000000-0000-0000-0000-000000000009', '2026-10-19', 120)$$, '23514', null, 'confidence is a percentage');
select throws_ok($$insert into public.habits (name, weekdays) values ('Bad days', array[7]::smallint[])$$, '23514', null, 'habit weekdays are 0–6');

-- Bob: sees nothing, and cannot attach rows to alice's habit or goal
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select is((select count(*)::int from public.reviews), 0, 'bob sees no reviews of alice');
select is((select count(*)::int from public.outcomes), 0, 'bob sees no outcomes of alice');
select is((select count(*)::int from public.missions), 0, 'bob sees no missions of alice');
select is((select count(*)::int from public.personal_records), 0, 'bob sees no records of alice');
select is((select count(*)::int from public.habits), 0, 'bob sees no habits of alice');
select is((select count(*)::int from public.habit_logs), 0, 'bob sees no habit logs of alice');
select is((select count(*)::int from public.goal_confidence), 0, 'bob sees no forecasts of alice');
select throws_ok($$insert into public.habit_logs (habit_id, day) values ('80000000-0000-0000-0000-000000000001', '2026-10-13')$$,
  '23503', null, 'bob cannot log against alice''s habit');
select throws_ok($$insert into public.goal_confidence (goal_id, week_start, confidence_pct) values ('40000000-0000-0000-0000-000000000009', '2026-10-19', 50)$$,
  '23503', null, 'bob cannot forecast alice''s goal');
update public.outcomes set result = 'missed';
update public.personal_records set value = 1;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is((select result from public.outcomes), null, 'bob''s update did not touch alice''s outcome');
select is((select value from public.personal_records)::int, 55, 'bob''s update did not touch alice''s record');

select * from finish();
rollback;
