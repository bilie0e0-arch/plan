-- M4 security: pairing by code, sharing levels, presence consent, invites, pair sessions, blocks, leaving
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test.dev', '{"username":"alice"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@test.dev',   '{"username":"bob"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'carol@test.dev', '{"username":"carol"}');

select matches((select partner_code from public.profiles where username = 'bob'), '^PLN-[2-9A-HJKMNP-Z]{5}$', 'every account gets a partner code');
create temp table codes as select username::text as u, partner_code as c from public.profiles;
grant select on codes to authenticated;

set local role authenticated;

-- Alice requests Bob by code
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is(public.request_partner((select c from codes where u = 'bob')), 'sent', 'request by code is sent');
select is(public.request_partner('PLN-ZZZZZ'), 'not_found', 'unknown code finds nobody');
select is((select count(*)::int from public.profiles), 1, 'a code lookup never exposes other profiles');

-- Carol sees nothing of it
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
select is((select count(*)::int from public.partner_requests), 0, 'others cannot see a request');

-- Bob accepts
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select is(public.respond_partner_request((select id from public.partner_requests limit 1), 'accept'), 'paired', 'request accepted → paired');
select ok(public.is_partner('00000000-0000-0000-0000-0000000000a1'), 'bob and alice are partners');
select is((select count(*)::int from public.group_members), 2, 'a member sees the pair (no policy recursion)');
create temp table grp as select id from public.groups;
grant select on grp to authenticated;
insert into public.tasks (title, first_action, status, planned_for) values ('Secret plan', 'Open file', 'today', current_date);
insert into public.tasks (title, first_action, status, planned_for, share_override) values ('Very private', 'x', 'today', current_date, 'private');
insert into public.presence (user_id, status) values ('00000000-0000-0000-0000-0000000000b2', 'focus');

-- Alice sees counts by default, never titles; private overrides are not even counted
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is((public.partner_snapshot() ->> 'planned')::int, 1, 'count sharing shows how many (private override excluded)');
select ok(not (public.partner_snapshot() ? 'tasks'), 'count sharing hides titles');
select is((select status from public.presence where user_id = '00000000-0000-0000-0000-0000000000b2'), 'focus', 'partner sees status when shown');
select is((select count(*)::int from public.tasks), 0, 'partner still cannot read base tables');

-- Bob switches to exact sharing and hides his status
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
update public.settings set share_level = 'exact', presence_visible = false where owner_id = '00000000-0000-0000-0000-0000000000b2';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is(jsonb_array_length(public.partner_snapshot() -> 'tasks'), 1, 'exact sharing shows titles, still not private ones');
select is((public.partner_snapshot() -> 'tasks' -> 0 ->> 'title'), 'Open file', 'shared title is the first step');
select is((select count(*)::int from public.presence where user_id = '00000000-0000-0000-0000-0000000000b2'), 0, 'hidden status is not visible');

-- Carol: not a partner
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
select is(public.partner_snapshot(), null, 'non-partner gets no snapshot');
select throws_ok($$insert into public.reactions (group_id, to_user, kind) select id, '00000000-0000-0000-0000-0000000000a1', 'clap' from grp$$,
  '42501', null, 'non-partner cannot react to someone else''s partner');
select is(public.request_partner((select c from codes where u = 'alice')), 'sent', 'people with friends can still be asked (many friends allowed)');

-- Session invite → pair session → shared countdown
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is(public.send_session_invite(50) ->> 'status', 'sent', 'session invite sent');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
create temp table cs as select (public.respond_session_invite((select id from public.session_invites limit 1), 'accept') ->> 'co_session_id')::uuid as id;
grant select on cs to authenticated;
select is((select status from public.co_sessions), 'checkin', 'accepting opens a pair session');
select is(public.co_ready((select id from cs), 'Ch 4', 'Read ch 4', 'video'), null, 'first ready does not start yet');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select isnt(public.co_ready((select id from cs), 'Draft', 'Write draft', 'none'), null, 'last ready starts the shared countdown');
select is((select task_title from public.co_session_members where user_id = '00000000-0000-0000-0000-0000000000a1'), null,
  'task title is not shared at count level');
select is((select goal_text from public.co_session_members where user_id = '00000000-0000-0000-0000-0000000000a1'), null,
  'goal text is not shared at count level — only that a goal is set');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
select throws_ok($$select public.co_ready((select id from cs), 'x', 'x', 'none')$$, 'P0001', null, 'outsiders cannot act in a pair session');

-- Leaving ends everything immediately
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select public.leave_partner();
select is(public.partner_snapshot(), null, 'after leaving, nothing is shared');
select is((select status from public.co_sessions), null, 'after leaving, the old pair session is no longer visible');

select * from finish();
rollback;
