-- Data API access is explicit: anon gets nothing, signed-in users only what RLS allows, new objects stay private.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select ok(not has_table_privilege('anon', 'public.tasks', 'select'), 'anon cannot read tasks');
select ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'anon cannot read profiles');
select ok(has_table_privilege('authenticated', 'public.tasks', 'select, insert, update, delete'), 'signed-in users can use tasks (RLS still applies)');
select ok(not has_table_privilege('authenticated', 'public.commitments', 'update'), 'commitments stay append-only');
select ok(not has_function_privilege('authenticated', 'public.email_for_username(text)', 'execute'), 'login helpers stay server-only');
select ok(has_function_privilege('authenticated', 'public.friends_snapshot()', 'execute'), 'app functions are callable when signed in');

create table public.zz_new_table (id int);
select ok(not has_table_privilege('authenticated', 'public.zz_new_table', 'select'), 'a new table is private until granted');

select * from finish();
rollback;
