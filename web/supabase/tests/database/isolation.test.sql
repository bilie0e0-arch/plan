-- Consolidated security test: signup trigger, per-user isolation, cross-user writes, server-only functions
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test.dev', '{"username":"alice","timezone":"Asia/Kolkata"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@test.dev',   '{"username":"bob"}');

-- signup trigger
select is((select count(*)::int from public.profiles where user_id in
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b2')), 2, 'trigger creates profiles');
select is((select count(*)::int from public.ladder_state where owner_id in
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b2')), 2, 'trigger creates ladder state');
select is((select timezone from public.profiles where user_id = '00000000-0000-0000-0000-0000000000b2'), 'UTC', 'timezone defaults to UTC');
select throws_ok($$insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000c3','c@test.dev','{"username":"admin"}')$$,
  '23514', null, 'reserved username rejected');

-- server-only helpers (as postgres)
select is(public.email_for_username('ALICE'), 'alice@test.dev', 'username lookup is case-insensitive');
select public.record_login_attempt('alice', '1.2.3.4', false) from generate_series(1, 5);
select is(public.login_allowed('alice', '9.9.9.9'), false, '5 failures block the username');
select is(public.login_allowed('bob', '9.9.9.9'), true, 'other usernames unaffected');

-- alice creates data
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
insert into public.projects (id, name) values ('10000000-0000-0000-0000-000000000001', 'GMAT');
insert into public.tasks (id, title, project_id) values ('20000000-0000-0000-0000-000000000001', 'Open RC set 4', '10000000-0000-0000-0000-000000000001');
insert into public.sessions (id, task_id, mode) values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'ladder');
insert into public.day_plans (day, energy) values ('2026-10-08', 4);
select is((select count(*)::int from public.tasks), 1, 'alice sees her task');
select throws_ok($$insert into public.sessions (task_id, mode) values ('20000000-0000-0000-0000-000000000001', 'free')$$,
  '23505', null, 'only one open session per user');
select throws_ok($$update public.profiles set username = 'alice2'$$, '42501', null, 'username is permanent');

-- bob cannot see or touch alice's data
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select is((select count(*)::int from public.projects), 0, 'bob sees no projects of alice');
select is((select count(*)::int from public.tasks), 0, 'bob sees no tasks of alice');
select is((select count(*)::int from public.sessions), 0, 'bob sees no sessions of alice');
select is((select count(*)::int from public.day_plans), 0, 'bob sees no day plans of alice');
select is((select count(*)::int from public.task_actuals), 0, 'view respects RLS');
select is((select count(*)::int from public.profiles), 1, 'bob sees only his profile');
select throws_ok($$insert into public.projects (owner_id, name) values ('00000000-0000-0000-0000-0000000000a1', 'Hack')$$,
  '42501', null, 'bob cannot insert as alice');
select throws_ok($$insert into public.tasks (title, project_id) values ('Sneaky', '10000000-0000-0000-0000-000000000001')$$,
  '23503', null, 'bob cannot attach a task to alice''s project');
select throws_ok($$insert into public.sessions (task_id, mode) values ('20000000-0000-0000-0000-000000000001', 'free')$$,
  '23503', null, 'bob cannot start a session on alice''s task');

-- anon cannot call server-only helpers
set local role anon;
select throws_ok($$select public.email_for_username('alice')$$, '42501', null, 'anon cannot look up emails');

select * from finish();
rollback;
