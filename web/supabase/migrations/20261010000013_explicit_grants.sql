-- Data API access is granted explicitly, so the project can run with "Automatically expose new tables" turned off.
-- Signed-in users reach tables only through RLS policies; the server (service_role) has full access; anon has none.
-- From now on every migration that adds a table or function must grant it (see web/README.md).

-- ───────────── tables ─────────────
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

-- Keep the narrower rights set earlier.
revoke update on public.profiles from authenticated;
grant update (display_name, timezone, day_boundary_hour) on public.profiles to authenticated;
revoke update, delete on public.commitments, public.commitment_revisions from authenticated;

-- ───────────── sequences ─────────────
revoke all on all sequences in schema public from anon;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- ───────────── functions ─────────────
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
-- Login helpers stay server-only.
revoke execute on function public.login_allowed(text, text), public.record_login_attempt(text, text, boolean),
  public.email_for_username(text), public.username_available(text) from authenticated;

-- ───────────── new objects are private until granted ─────────────
alter default privileges in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated, service_role;
