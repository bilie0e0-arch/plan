-- Login rate limiting and server-only auth helpers
create table public.login_attempts (
  id bigint generated always as identity primary key,
  username text not null,
  ip text not null,
  success boolean not null,
  at timestamptz not null default now()
);
create index login_attempts_username_idx on public.login_attempts (username, at desc);
create index login_attempts_ip_idx on public.login_attempts (ip, at desc);
-- RLS on, no policies: invisible to anon/authenticated
alter table public.login_attempts enable row level security;

create or replace function public.login_allowed(p_username text, p_ip text)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.login_attempts
      where username = lower(p_username) and not success and at > now() - interval '15 minutes') < 5
    and
    (select count(*) from public.login_attempts
      where ip = p_ip and not success and at > now() - interval '15 minutes') < 20;
$$;

create or replace function public.record_login_attempt(p_username text, p_ip text, p_success boolean)
returns void language sql security definer set search_path = '' as $$
  insert into public.login_attempts (username, ip, success) values (lower(p_username), p_ip, p_success);
$$;

create or replace function public.email_for_username(p_username text)
returns text language sql stable security definer set search_path = '' as $$
  select u.email::text
  from auth.users u
  join public.profiles p on p.user_id = u.id
  where p.username::text = lower(p_username);
$$;

create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles where username::text = lower(p_username));
$$;

revoke execute on function public.login_allowed(text, text) from public, anon, authenticated;
revoke execute on function public.record_login_attempt(text, text, boolean) from public, anon, authenticated;
revoke execute on function public.email_for_username(text) from public, anon, authenticated;
revoke execute on function public.username_available(text) from public, anon, authenticated;
grant execute on function public.login_allowed(text, text) to service_role;
grant execute on function public.record_login_attempt(text, text, boolean) to service_role;
grant execute on function public.email_for_username(text) to service_role;
grant execute on function public.username_available(text) to service_role;
