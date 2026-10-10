-- Friends: several friends, sharing chosen per friend, group rooms that don't make room-mates friends
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ann@test.dev',  '{"username":"ann"}'),
  ('00000000-0000-0000-0000-00000000000b', 'ben@test.dev',  '{"username":"ben"}'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@test.dev',  '{"username":"cat"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dan@test.dev',  '{"username":"dan"}');
create temp table codes as select username::text as u, partner_code as c from public.profiles;
grant select on codes to authenticated;
set local role authenticated;

-- Ann befriends Ben and Cat (two separate friendships); Ben and Cat are not friends
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is(public.request_partner((select c from codes where u = 'ben')), 'sent', 'first friend request');
select is(public.request_partner((select c from codes where u = 'cat')), 'sent', 'a second friend request is allowed');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is(public.respond_partner_request((select id from public.partner_requests where to_user = '00000000-0000-0000-0000-00000000000b'), 'accept'), 'paired', 'ben accepts');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select is(public.respond_partner_request((select id from public.partner_requests where to_user = '00000000-0000-0000-0000-00000000000c'), 'accept'), 'paired', 'cat accepts');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is(jsonb_array_length(public.friends_snapshot()), 2, 'ann has two friends');
select is(public.request_partner((select c from codes where u = 'ben')), 'already_friends', 'no duplicate friendship');
insert into public.tasks (title, first_action, status, planned_for) values ('Thesis', 'Outline ch 2', 'today', current_date);
select public.set_friend_share('00000000-0000-0000-0000-00000000000b', 'exact');

-- Per-friend sharing: Ben sees the title, Cat (default count) only the count
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((public.friends_snapshot() -> 0 -> 'tasks' -> 0 ->> 'title'), 'Outline ch 2', 'exact for this friend shows titles');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select ok(not (public.friends_snapshot() -> 0 ? 'tasks'), 'another friend at count level sees no titles');
select is((public.friends_snapshot() -> 0 ->> 'planned')::int, 1, 'but does see the count');
select ok(not public.is_partner('00000000-0000-0000-0000-00000000000b'), 'friends of friends are not friends');
select throws_ok($$select public.set_friend_share('00000000-0000-0000-0000-00000000000b', 'exact')$$, 'P0001', null, 'cannot set sharing for a non-friend');

-- A group room: Ann invites Ben and Cat; both accept into one session
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is(public.send_session_invite(50, array['00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000c']::uuid[], 'video') ->> 'sent', '2', 'one invite per friend');
select is(public.send_session_invite(50, array['00000000-0000-0000-0000-00000000000d']::uuid[]) ->> 'status', 'not_friends', 'cannot invite a stranger');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
create temp table rs as select (public.respond_session_invite((select id from public.session_invites where to_user = '00000000-0000-0000-0000-00000000000b'), 'accept') ->> 'co_session_id')::uuid as id;
grant select on rs to authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select is((public.respond_session_invite((select id from public.session_invites where to_user = '00000000-0000-0000-0000-00000000000c'), 'accept') ->> 'co_session_id')::uuid,
  (select id from rs), 'the second friend joins the same room');
select is((select count(*)::int from public.session_people((select id from rs))), 3, 'everyone in the room sees the three names');
select is((select call_mode from public.co_sessions where id = (select id from rs)), 'video', 'the room takes the call type the host picked');
select lives_ok($$select public.co_set_call((select id from rs), 'audio')$$, 'anyone in the room can switch the call');
select is((select call_mode || ':' || (call_changed_by = '00000000-0000-0000-0000-00000000000c')::text from public.co_sessions where id = (select id from rs)), 'audio:true',
  'the switch applies to everyone and records who switched');
select throws_ok($$select public.co_set_call((select id from rs), 'hologram')$$, 'P0001', null, 'only video, audio or no call');
select lives_ok($$insert into public.call_signals (co_session_id, to_user, kind, payload) values ((select id from rs), '00000000-0000-0000-0000-00000000000b', 'ice', '{}')$$,
  'room members can signal each other for the group call');
select throws_ok($$insert into public.reactions (group_id, to_user, kind) select group_id, '00000000-0000-0000-0000-00000000000b', 'clap' from public.co_sessions where id = (select id from rs)$$,
  '42501', null, 'room-mates who are not friends cannot send reactions');

-- Outsiders see nothing of the room
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}';
select is((select count(*)::int from public.co_sessions), 0, 'a stranger cannot see the room');

select * from finish();
rollback;
