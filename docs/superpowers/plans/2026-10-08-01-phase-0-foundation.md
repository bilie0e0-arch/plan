# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed Next.js + Supabase app where users sign up and log in with username + password, each user's data is isolated by row-level security, and a user can create projects and capture tasks in under 2 seconds from any screen.

**Architecture:** Next.js 16 App Router app in `web/`, deployed to Vercel. Supabase provides Postgres (RLS on every table, access via `public.can_read`), password auth (email used only for recovery; login by username via a server-only lookup function), and rate limiting via a `login_attempts` table. Pure logic (capture parsing, validation, breached-password check, redirects, hotkeys) lives in `src/domain/` and `src/lib/` with Vitest tests. RLS is verified by pgTAP; user journeys by Playwright.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind v4, shadcn/ui (dialog, command, button, input, label), Zod, `@supabase/ssr`, `@supabase/supabase-js`, Supabase CLI, Vitest, pgTAP, Playwright, GitHub Actions.

**Spec:** `D:\plan\DESIGN.md` — F1, F3, F25, F26, F51–F54 (§8, §11.10, §16 Phase 0).

**Prerequisites on the machine:** Node.js 22 LTS, npm, Git, Docker Desktop running (for the local Supabase stack).

**Execution mode — LEAN (owner decision, overrides the per-task steps below):**
- Build the whole phase in one pass; tasks are an order of work and a code reference, not separate cycles.
- Skip the "run test to verify it fails" steps and per-task manual checks.
- Tests kept: one consolidated RLS isolation test (Tasks 3–5 SQL tests may be merged into one file), unit tests for `parse-capture` and `validation` only, and **one** E2E smoke test (sign up → capture → second user can't see it). Other test files in this plan are optional.
- Run lint, typecheck, unit, DB and E2E **once at the end** of the phase; fix what fails.
- CI (Task 18) stays — it runs automatically on push.
- Goal: a working, safe result at the end — not perfection at every step.

**Owner rules:** the owner commits manually — "Checkpoint" steps list the suggested commit. Remote database changes (Task 19) require owner approval.

---

## File map

| File | Responsibility |
|---|---|
| `web/src/domain/capture/parse-capture.ts` | Parse capture text + `#project ~30m !deep !speak` tokens |
| `web/src/domain/auth/validation.ts` | Username / password / signup Zod schemas, reserved names |
| `web/src/domain/auth/breached-password.ts` | HaveIBeenPwned k-anonymity check (fail-open) |
| `web/src/domain/auth/safe-next.ts` | Validate post-auth redirect paths |
| `web/src/lib/hotkeys.ts` | Decide whether a keydown should trigger a global shortcut |
| `web/src/lib/env.ts` | Public env vars (validated) |
| `web/src/lib/server-env.ts` | Server-only env vars (validated) |
| `web/src/lib/supabase/{client,server,admin,proxy}.ts` | Supabase clients per context + session refresh |
| `web/src/lib/supabase/database.types.ts` | Generated DB types |
| `web/src/proxy.ts` | Next.js proxy: refresh session, protect routes |
| `web/src/app/(auth)/actions.ts` | signup, login, logout, forgot, reset Server Actions |
| `web/src/app/(auth)/{login,signup,forgot-password,check-email}/page.tsx` | Auth pages |
| `web/src/app/reset-password/page.tsx` | Set new password after recovery link |
| `web/src/app/auth/confirm/route.ts` | Email confirmation / recovery link handler |
| `web/src/app/(app)/layout.tsx` | Authenticated shell (loads username) |
| `web/src/app/(app)/page.tsx` | Home (Phase 0: redirects to Inbox) |
| `web/src/app/(app)/inbox/page.tsx` | Captured tasks list |
| `web/src/app/(app)/projects/{page.tsx,actions.ts,project-form.tsx}` | Projects list + create |
| `web/src/app/(app)/capture-actions.ts` | `captureTask` Server Action |
| `web/src/components/shell/app-shell.tsx` | Sidebar, hotkeys, palette + capture mounting |
| `web/src/components/shell/command-palette.tsx` | Ctrl+K palette |
| `web/src/components/capture/capture-dialog.tsx` | Quick capture overlay |
| `web/src/app/manifest.ts`, `web/scripts/make-icons.mjs`, `web/public/icons/*` | PWA |
| `web/supabase/migrations/*.sql` | Schema |
| `web/supabase/tests/database/*.test.sql` | pgTAP RLS tests |
| `web/e2e/*.spec.ts`, `web/playwright.config.ts` | E2E tests |
| `.github/workflows/ci.yml` | CI |

---

### Task 1: Repository and Next.js scaffold

**Files:**
- Create: `D:\plan\.gitignore`, `D:\plan\web\` (scaffold)
- Modify: `web/package.json`, `web/tsconfig.json`

- [ ] **Step 1: Make `D:\plan` its own Git repository**

`D:\plan` currently sits inside the `D:\` repository. Give it its own:

```bash
cd /d/plan
git init -b main
```
Expected: `Initialized empty Git repository in D:/plan/.git/`

- [ ] **Step 2: Scaffold Next.js 16 into `web/`**

```bash
cd /d/plan
npx create-next-app@16 web --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```
Expected: `Success! Created web at D:\plan\web`. If the CLI asks interactive questions not covered by flags, accept defaults.

- [ ] **Step 3: Verify Next.js major version**

```bash
cd /d/plan/web && npx next --version
```
Expected: `Next.js v16.x.x`. This plan uses `src/proxy.ts` (Next ≥ 16). If the version is 15, name the file `src/middleware.ts` and the exported function `middleware` in Task 6 instead.

- [ ] **Step 4: Root `.gitignore`**

Create `D:\plan\.gitignore`:
```gitignore
node_modules/
.env*.local
.vercel/
web/supabase/.temp/
web/test-results/
web/playwright-report/
```

- [ ] **Step 4b: Force LF line endings**

Create `D:\plan\.gitattributes` (Windows checkouts otherwise get CRLF, which breaks the CI generated-types diff):
```gitattributes
* text=auto eol=lf
*.png binary
```

- [ ] **Step 5: Strict TypeScript extras**

In `web/tsconfig.json`, inside `compilerOptions`, add (keep existing keys):
```json
"noUncheckedIndexedAccess": true,
"noImplicitOverride": true
```

- [ ] **Step 6: Install dependencies**

```bash
cd /d/plan/web
npm i @supabase/ssr @supabase/supabase-js zod server-only
npm i -D supabase vitest @playwright/test sharp
```

- [ ] **Step 7: Add scripts to `web/package.json`**

Add to `"scripts"` (keep existing `dev`, `build`, `start`, `lint`):
```json
"typecheck": "tsc --noEmit",
"test": "vitest run",
"test:watch": "vitest",
"test:db": "supabase test db",
"test:e2e": "playwright test",
"db:start": "supabase start",
"db:stop": "supabase stop",
"db:reset": "supabase db reset",
"db:types": "supabase gen types typescript --local > src/lib/supabase/database.types.ts",
"icons": "node scripts/make-icons.mjs"
```

- [ ] **Step 8: Vitest config**

Create `web/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
```

- [ ] **Step 9: Verify the toolchain**

```bash
cd /d/plan/web && npm run typecheck && npm run lint && npx vitest run --passWithNoTests
```
Expected: all three exit with code 0.

- [ ] **Step 10: Checkpoint (owner commits)**

Suggested: `chore: scaffold Next.js 16 app with strict TS and Vitest`

---

### Task 2: Local Supabase stack

**Files:**
- Create: `web/supabase/config.toml` (generated), `web/.env.local`, `web/.env.example`

- [ ] **Step 1: Initialise Supabase**

```bash
cd /d/plan/web && npx supabase init
```
Expected: `Finished supabase init.` and a `supabase/` folder.

- [ ] **Step 2: Confirm local auth settings in `web/supabase/config.toml`**

Ensure these values (edit if different):
```toml
[auth]
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000"]

[auth.email]
enable_signup = true
enable_confirmations = false
```
Local confirmations are off so E2E tests can sign up without email. Production turns them on (Task 19).

- [ ] **Step 3: Start the stack (Docker Desktop must be running)**

```bash
cd /d/plan/web && npx supabase start
```
Expected: prints `API URL: http://127.0.0.1:54321` plus keys.

- [ ] **Step 4: Create `web/.env.example`**

```dotenv
# Public (safe in browser)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=paste-publishable-or-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Server only (never exposed to the browser)
SUPABASE_SECRET_KEY=paste-secret-or-service-role-key
# on | off  (off in tests)
PASSWORD_BREACH_CHECK=on
```

- [ ] **Step 5: Create `web/.env.local`**

Copy `.env.example` to `.env.local` and paste values from `npx supabase status`: the **Publishable key** (or legacy **anon key**) into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and the **Secret key** (or legacy **service_role key**) into `SUPABASE_SECRET_KEY`. Either key style works.

- [ ] **Step 6: Checkpoint (owner commits)**

Suggested: `chore: add local Supabase stack config`

---

### Task 3: Profiles, settings and signup trigger (migration + RLS tests)

**Files:**
- Create: `web/supabase/migrations/20261008000001_profiles_settings.sql`
- Test: `web/supabase/tests/database/01_profiles.test.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `web/supabase/tests/database/01_profiles.test.sql`:
```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test.dev', '{"username":"alice","timezone":"Asia/Kolkata"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@test.dev',   '{"username":"bob"}');

select is(
  (select count(*)::int from public.profiles where user_id in ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b2')),
  2, 'trigger creates a profile per new user');

select is(
  (select timezone from public.profiles where user_id = '00000000-0000-0000-0000-0000000000b2'),
  'UTC', 'timezone defaults to UTC when not supplied');

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000c3','c@test.dev','{"username":"ALICE"}')$$,
  '23514', null, 'uppercase username rejected by check constraint');

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000d4','d@test.dev','{"username":"admin"}')$$,
  '23514', null, 'reserved username rejected');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select is((select count(*)::int from public.profiles), 1, 'alice sees only her own profile');
select is((select count(*)::int from public.settings), 1, 'alice sees only her own settings');

select throws_ok(
  $$update public.profiles set username = 'alice2' where user_id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'username cannot be changed by the user');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /d/plan/web && npx supabase test db
```
Expected: FAIL — `relation "public.profiles" does not exist`.

- [ ] **Step 3: Write the migration**

Create `web/supabase/migrations/20261008000001_profiles_settings.sql`:
```sql
create extension if not exists citext with schema extensions;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext not null unique
    check (username::text ~ '^[a-z0-9_]{3,20}$')
    check (username::text not in ('admin','root','support','api','www','help','system','plan')),
  display_name text check (char_length(display_name) <= 60),
  timezone text not null default 'UTC',
  day_boundary_hour smallint not null default 4 check (day_boundary_hour between 0 and 23),
  created_at timestamptz not null default now()
);

create table public.settings (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  wip_cap smallint not null default 7 check (wip_cap between 3 and 9),
  active_project_cap smallint not null default 5 check (active_project_cap between 3 and 7),
  theme text not null default 'system' check (theme in ('system','light','dark')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, username, timezone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC')
  );
  insert into public.settings (owner_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.settings enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Users may update only these profile columns (username is permanent)
revoke update on public.profiles from authenticated;
grant update (display_name, timezone, day_boundary_hour) on public.profiles to authenticated;

create policy settings_select_own on public.settings
  for select to authenticated using (owner_id = (select auth.uid()));
create policy settings_update_own on public.settings
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
```

- [ ] **Step 4: Apply and run tests**

```bash
cd /d/plan/web && npx supabase db reset && npx supabase test db
```
Expected: `01_profiles.test.sql .. ok` and `All tests successful.`

- [ ] **Step 5: Checkpoint (owner commits)**

Suggested: `feat(db): profiles and settings with signup trigger and RLS`

---

### Task 4: Access function, projects and tasks (migration + isolation tests)

**Files:**
- Create: `web/supabase/migrations/20261008000002_projects_tasks.sql`
- Test: `web/supabase/tests/database/02_projects_tasks.test.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `web/supabase/tests/database/02_projects_tasks.test.sql`:
```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test.dev', '{"username":"alice"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@test.dev',   '{"username":"bob"}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

insert into public.projects (id, name) values ('10000000-0000-0000-0000-000000000001', 'GMAT');
select is((select owner_id from public.projects where id = '10000000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'owner_id defaults to the current user');

select throws_ok($$insert into public.projects (name) values ('gmat')$$,
  '23505', null, 'project names are unique per user, case-insensitive');

insert into public.tasks (title, project_id) values ('Open RC set 4', '10000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.tasks), 1, 'alice sees her task');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';

select is((select count(*)::int from public.projects), 0, 'bob cannot see alice''s projects');
select is((select count(*)::int from public.tasks), 0, 'bob cannot see alice''s tasks');

select throws_ok(
  $$insert into public.projects (owner_id, name) values ('00000000-0000-0000-0000-0000000000a1', 'Hack')$$,
  '42501', null, 'bob cannot insert rows owned by alice');

select throws_ok(
  $$insert into public.tasks (title, project_id) values ('Sneaky', '10000000-0000-0000-0000-000000000001')$$,
  '23503', null, 'bob cannot attach a task to alice''s project');

update public.tasks set title = 'changed';
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is((select title from public.tasks limit 1), 'Open RC set 4', 'bob''s update did not touch alice''s task');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /d/plan/web && npx supabase test db
```
Expected: `02_projects_tasks.test.sql` FAILS — `relation "public.projects" does not exist`.

- [ ] **Step 3: Write the migration**

Create `web/supabase/migrations/20261008000002_projects_tasks.sql`:
```sql
-- Single access-check function. v1: ownership only.
-- Phase 7 extends it with shares/groups without touching any policy.
create or replace function public.can_read(p_owner_id uuid, p_resource_type text, p_resource_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_owner_id = (select auth.uid());
$$;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name extensions.citext not null check (char_length(name::text) between 1 and 40),
  color text not null default 'slate'
    check (color in ('slate','teal','blue','violet','rose','amber','green','stone')),
  status text not null default 'active' check (status in ('active','paused','done')),
  weekly_budget_minutes integer not null default 0 check (weekly_budget_minutes between 0 and 10080),
  visibility text not null default 'private' check (visibility in ('private','shared')),
  created_at timestamptz not null default now(),
  unique (owner_id, name),
  unique (id, owner_id)
);
create index projects_owner_idx on public.projects (owner_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid,
  title text not null check (char_length(title) between 1 and 500),
  status text not null default 'inbox'
    check (status in ('inbox','today','evening','backlog','someday','done','killed')),
  kind text not null default 'work' check (kind in ('work','speak')),
  estimate_minutes integer check (estimate_minutes between 1 and 1440),
  energy text check (energy in ('deep','shallow','admin')),
  visibility text not null default 'private' check (visibility in ('private','shared')),
  last_touched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- composite FK: a task can only reference a project with the same owner
  foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete set null (project_id)
);
create index tasks_owner_status_idx on public.tasks (owner_id, status, created_at desc);

alter table public.projects enable row level security;
alter table public.tasks enable row level security;

create policy projects_select on public.projects for select to authenticated
  using (public.can_read(owner_id, 'project', id));
create policy projects_insert on public.projects for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy projects_update on public.projects for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy projects_delete on public.projects for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy tasks_select on public.tasks for select to authenticated
  using (public.can_read(owner_id, 'task', id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy tasks_update on public.tasks for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy tasks_delete on public.tasks for delete to authenticated
  using (owner_id = (select auth.uid()));
```

- [ ] **Step 4: Apply and run tests**

```bash
cd /d/plan/web && npx supabase db reset && npx supabase test db
```
Expected: both test files `ok`, `All tests successful.`

- [ ] **Step 5: Checkpoint (owner commits)**

Suggested: `feat(db): can_read access function, projects and tasks with isolation tests`

---

### Task 5: Login rate limiting and auth helper functions (migration + tests)

**Files:**
- Create: `web/supabase/migrations/20261008000003_auth_helpers.sql`
- Test: `web/supabase/tests/database/03_auth_helpers.test.sql`

- [ ] **Step 1: Write the failing pgTAP test**

Create `web/supabase/tests/database/03_auth_helpers.test.sql`:
```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@test.dev', '{"username":"alice"}');

select is(public.email_for_username('Alice'), 'alice@test.dev', 'lookup is case-insensitive');
select is(public.email_for_username('nobody'), null, 'unknown username returns null');
select is(public.username_available('alice'), false, 'taken username is unavailable');
select is(public.username_available('carol'), true, 'free username is available');

select public.record_login_attempt('alice', '1.2.3.4', false) from generate_series(1, 5);
select is(public.login_allowed('alice', '9.9.9.9'), false, '5 failures for a username blocks it');
select is(public.login_allowed('bob', '9.9.9.9'), true, 'other usernames are not blocked');

set local role anon;
select throws_ok($$select public.email_for_username('alice')$$, '42501', null,
  'anon cannot call email lookup');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /d/plan/web && npx supabase test db
```
Expected: `03_auth_helpers.test.sql` FAILS — `function public.email_for_username(unknown) does not exist`.

- [ ] **Step 3: Write the migration**

Create `web/supabase/migrations/20261008000003_auth_helpers.sql`:
```sql
create table public.login_attempts (
  id bigint generated always as identity primary key,
  username text not null,
  ip text not null,
  success boolean not null,
  at timestamptz not null default now()
);
create index login_attempts_username_idx on public.login_attempts (username, at desc);
create index login_attempts_ip_idx on public.login_attempts (ip, at desc);
-- RLS on with no policies: no access for anon/authenticated
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
  where p.username = p_username::extensions.citext;
$$;

create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles where username = p_username::extensions.citext);
$$;

-- Server-only: callable with the secret key (service_role), never from the browser
revoke execute on function public.login_allowed(text, text) from public, anon, authenticated;
revoke execute on function public.record_login_attempt(text, text, boolean) from public, anon, authenticated;
revoke execute on function public.email_for_username(text) from public, anon, authenticated;
revoke execute on function public.username_available(text) from public, anon, authenticated;
grant execute on function public.login_allowed(text, text) to service_role;
grant execute on function public.record_login_attempt(text, text, boolean) to service_role;
grant execute on function public.email_for_username(text) to service_role;
grant execute on function public.username_available(text) to service_role;
```

- [ ] **Step 4: Apply and run tests**

```bash
cd /d/plan/web && npx supabase db reset && npx supabase test db
```
Expected: three test files `ok`, `All tests successful.`

- [ ] **Step 5: Generate DB types**

```bash
cd /d/plan/web && mkdir -p src/lib/supabase && npm run db:types
```
Expected: `src/lib/supabase/database.types.ts` exists and contains `email_for_username`.

- [ ] **Step 6: Checkpoint (owner commits)**

Suggested: `feat(db): login rate limiting and server-only auth helper functions`

---

### Task 6: Environment, Supabase clients and proxy

**Files:**
- Create: `web/src/lib/env.ts`, `web/src/lib/server-env.ts`, `web/src/lib/supabase/client.ts`, `web/src/lib/supabase/server.ts`, `web/src/lib/supabase/admin.ts`, `web/src/lib/supabase/proxy.ts`, `web/src/proxy.ts`

- [ ] **Step 1: Public env**

Create `web/src/lib/env.ts`:
```ts
import { z } from 'zod'

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
})

// Each variable is referenced literally so Next.js can inline it in client bundles.
export const publicEnv = schema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
})
```

- [ ] **Step 2: Server-only env**

Create `web/src/lib/server-env.ts`:
```ts
import 'server-only'
import { z } from 'zod'

const schema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20),
  PASSWORD_BREACH_CHECK: z.enum(['on', 'off']).default('on'),
})

export const serverEnv = schema.parse({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  PASSWORD_BREACH_CHECK: process.env.PASSWORD_BREACH_CHECK,
})
```

- [ ] **Step 3: Browser client**

Create `web/src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'
import type { Database } from './database.types'

export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
}
```

- [ ] **Step 4: Server client (cookies)**

Create `web/src/lib/supabase/server.ts`:
```ts
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { publicEnv } from '@/lib/env'
import type { Database } from './database.types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Called from a Server Component: cookies are read-only there.
            // The proxy refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  )
}
```

- [ ] **Step 5: Admin client (secret key, server only)**

Create `web/src/lib/supabase/admin.ts`:
```ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { publicEnv } from '@/lib/env'
import { serverEnv } from '@/lib/server-env'
import type { Database } from './database.types'

export function createAdminClient() {
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

- [ ] **Step 6: Session refresh + route protection**

Create `web/src/lib/supabase/proxy.ts`:
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { publicEnv } from '@/lib/env'
import type { Database } from './database.types'

const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/check-email', '/auth']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  // Must be called to refresh the auth token. Do not add logic between client creation and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublic(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}
```

- [ ] **Step 7: Proxy entry point**

Create `web/src/proxy.ts`:
```ts
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)'],
}
```

- [ ] **Step 8: Verify**

```bash
cd /d/plan/web && npm run typecheck && npm run lint
```
Expected: exit code 0.

- [ ] **Step 9: Checkpoint (owner commits)**

Suggested: `feat: env validation, Supabase clients and session proxy`

---

### Task 7: Auth validation (TDD)

**Files:**
- Create: `web/src/domain/auth/validation.ts`
- Test: `web/src/domain/auth/validation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/domain/auth/validation.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { passwordSchema, signupSchema, usernameSchema } from './validation'

describe('usernameSchema', () => {
  it('lowercases and trims', () => {
    expect(usernameSchema.parse('  Harshit_96 ')).toBe('harshit_96')
  })
  it.each(['ab', 'a'.repeat(21), 'has space', 'dash-name', 'émile'])('rejects %s', (u) => {
    expect(usernameSchema.safeParse(u).success).toBe(false)
  })
  it('rejects reserved names', () => {
    const r = usernameSchema.safeParse('Admin')
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe('That username is reserved.')
  })
})

describe('passwordSchema', () => {
  it('requires at least 10 characters', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false)
    expect(passwordSchema.safeParse('longenough1').success).toBe(true)
  })
  it('does not require character classes', () => {
    expect(passwordSchema.safeParse('aaaaaaaaaaaa').success).toBe(true)
  })
  it('rejects more than 128 characters', () => {
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false)
  })
})

describe('signupSchema', () => {
  it('accepts a valid signup and defaults timezone to UTC', () => {
    const r = signupSchema.parse({ username: 'harshit', email: 'h@example.com', password: 'correct-horse' })
    expect(r.timezone).toBe('UTC')
  })
  it('accepts legacy timezone aliases browsers may report', () => {
    const r = signupSchema.safeParse({
      username: 'harshit', email: 'h@example.com', password: 'correct-horse', timezone: 'Asia/Calcutta',
    })
    expect(r.success).toBe(true)
  })
  it('rejects an unknown timezone', () => {
    const r = signupSchema.safeParse({
      username: 'harshit', email: 'h@example.com', password: 'correct-horse', timezone: 'Mars/Base',
    })
    expect(r.success).toBe(false)
  })
  it('rejects a bad email', () => {
    expect(signupSchema.safeParse({ username: 'harshit', email: 'nope', password: 'correct-horse' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /d/plan/web && npx vitest run src/domain/auth/validation.test.ts
```
Expected: FAIL — `Failed to resolve import "./validation"`.

- [ ] **Step 3: Implement**

Create `web/src/domain/auth/validation.ts`:
```ts
import { z } from 'zod'

export const RESERVED_USERNAMES: readonly string[] = [
  'admin', 'root', 'support', 'api', 'www', 'help', 'system', 'plan',
]

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, 'Username: 3–20 characters — lowercase letters, digits or _.')
  .refine((u) => !RESERVED_USERNAMES.includes(u), 'That username is reserved.')

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(128, 'Password must be at most 128 characters.')

export const signupSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().email('Enter a valid email.'),
  password: passwordSchema,
  timezone: z
    .string()
    .default('UTC')
    .refine(isValidTimeZone, 'Unknown timezone.'),
})

export type SignupInput = z.infer<typeof signupSchema>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /d/plan/web && npx vitest run src/domain/auth/validation.test.ts
```
Expected: PASS (all tests).

- [ ] **Step 5: Checkpoint (owner commits)**

Suggested: `feat(auth): username, password and signup validation`

---

### Task 8: Breached-password check (TDD)

**Files:**
- Create: `web/src/domain/auth/breached-password.ts`
- Test: `web/src/domain/auth/breached-password.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/domain/auth/breached-password.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { isPasswordBreached, type FetchLike } from './breached-password'

// SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const SUFFIX = '1E4C9B93F3F0682250B6CF8331B7EE68FD8'

function fakeFetch(body: string, ok = true) {
  return vi.fn<FetchLike>(async () => new Response(body, { status: ok ? 200 : 503 }))
}

describe('isPasswordBreached', () => {
  it('queries only the 5-char hash prefix', async () => {
    const f = fakeFetch('')
    await isPasswordBreached('password', f)
    expect(f).toHaveBeenCalledOnce()
    expect(f).toHaveBeenCalledWith('https://api.pwnedpasswords.com/range/5BAA6', expect.anything())
  })
  it('returns true when the suffix is listed with a positive count', async () => {
    const f = fakeFetch(`0000000000000000000000000000000000A:3\r\n${SUFFIX}:9545824\r\n`)
    expect(await isPasswordBreached('password', f)).toBe(true)
  })
  it('ignores padding entries with count 0', async () => {
    const f = fakeFetch(`${SUFFIX}:0\r\n`)
    expect(await isPasswordBreached('password', f)).toBe(false)
  })
  it('fails open when the service errors', async () => {
    expect(await isPasswordBreached('password', fakeFetch('', false))).toBe(false)
    const throwing = vi.fn<FetchLike>(async () => {
      throw new Error('network')
    })
    expect(await isPasswordBreached('password', throwing)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /d/plan/web && npx vitest run src/domain/auth/breached-password.test.ts
```
Expected: FAIL — `Failed to resolve import "./breached-password"`.

- [ ] **Step 3: Implement**

Create `web/src/domain/auth/breached-password.ts`:
```ts
import { createHash } from 'node:crypto'

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/**
 * HaveIBeenPwned k-anonymity check. Only the first 5 hex chars of the SHA-1 hash leave the server.
 * Fails open (returns false) if the service is unavailable, so signups never break on it.
 */
export async function isPasswordBreached(password: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  const hash = createHash('sha1').update(password).digest('hex').toUpperCase()
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)
  try {
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return false
    const body = await res.text()
    return body.split('\n').some((line) => {
      const [s, count] = line.trim().split(':')
      return s === suffix && Number(count) > 0
    })
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /d/plan/web && npx vitest run src/domain/auth/breached-password.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Checkpoint (owner commits)**

Suggested: `feat(auth): breached-password check via k-anonymity`

---

### Task 9: Safe redirect helper (TDD)

**Files:**
- Create: `web/src/domain/auth/safe-next.ts`
- Test: `web/src/domain/auth/safe-next.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/domain/auth/safe-next.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { safeNext } from './safe-next'

describe('safeNext', () => {
  it('allows same-site absolute paths', () => {
    expect(safeNext('/reset-password')).toBe('/reset-password')
    expect(safeNext('/inbox?x=1')).toBe('/inbox?x=1')
  })
  it.each([null, '', 'https://evil.com', '//evil.com', '/\\evil.com', 'inbox'])('falls back to / for %s', (v) => {
    expect(safeNext(v)).toBe('/')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /d/plan/web && npx vitest run src/domain/auth/safe-next.test.ts
```
Expected: FAIL — `Failed to resolve import "./safe-next"`.

- [ ] **Step 3: Implement**

Create `web/src/domain/auth/safe-next.ts`:
```ts
/** Only same-site absolute paths are allowed as post-auth redirects (prevents open redirects). */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  return next
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /d/plan/web && npx vitest run src/domain/auth/safe-next.test.ts
```
Expected: PASS.

- [ ] **Step 5: Checkpoint (owner commits)**

Suggested: `feat(auth): safe redirect helper`

---

### Task 10: Auth Server Actions

**Files:**
- Create: `web/src/app/(auth)/actions.ts`

- [ ] **Step 1: Implement the actions**

Create `web/src/app/(auth)/actions.ts`:
```ts
'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { publicEnv } from '@/lib/env'
import { serverEnv } from '@/lib/server-env'
import { passwordSchema, signupSchema } from '@/domain/auth/validation'
import { isPasswordBreached } from '@/domain/auth/breached-password'

export type AuthState = { error: string | null; notice?: string | null }

const GENERIC_LOGIN_ERROR = 'Username or password is incorrect.'
const GENERIC_FAILURE = 'Something went wrong. Please try again.'
const BREACHED = 'This password has appeared in a data breach. Please choose another.'

async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

async function breached(password: string): Promise<boolean> {
  return serverEnv.PASSWORD_BREACH_CHECK === 'on' && (await isPasswordBreached(password))
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    username: formData.get('username'),
    email: formData.get('email'),
    password: formData.get('password'),
    timezone: formData.get('timezone') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE }
  const { username, email, password, timezone } = parsed.data

  if (await breached(password)) return { error: BREACHED }

  const admin = createAdminClient()
  const { data: available, error: availErr } = await admin.rpc('username_available', { p_username: username })
  if (availErr) return { error: GENERIC_FAILURE }
  if (!available) return { error: 'That username is taken.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, timezone } },
  })
  if (error) return { error: 'Could not create the account. Please try again.' }

  // Email confirmation on (production): no session yet.
  if (!data.session) redirect('/check-email')
  redirect('/')
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = String(formData.get('username') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  if (!username || !password) return { error: GENERIC_LOGIN_ERROR }

  const ip = await clientIp()
  const admin = createAdminClient()

  const { data: allowed, error: limitErr } = await admin.rpc('login_allowed', { p_username: username, p_ip: ip })
  if (limitErr) return { error: GENERIC_FAILURE }
  if (!allowed) return { error: 'Too many attempts. Wait 15 minutes and try again.' }

  const { data: email } = await admin.rpc('email_for_username', { p_username: username })

  let success = false
  let unconfirmed = false
  if (email) {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    success = !error
    unconfirmed = error?.code === 'email_not_confirmed'
  }

  await admin.rpc('record_login_attempt', { p_username: username, p_ip: ip, p_success: success })

  if (unconfirmed) return { error: 'Please confirm your email first — check your inbox.' }
  if (!success) return { error: GENERIC_LOGIN_ERROR }
  redirect('/')
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  if (email) {
    const supabase = await createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
    })
  }
  // Same message whether or not the account exists (no account enumeration).
  return { error: null, notice: 'If an account uses that email, a reset link is on its way.' }
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = passwordSchema.safeParse(formData.get('password'))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE }
  if (await breached(parsed.data)) return { error: BREACHED }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data })
  if (error) return { error: 'Could not update the password. Request a new reset link.' }
  redirect('/')
}
```

- [ ] **Step 2: Verify types**

```bash
cd /d/plan/web && npm run typecheck
```
Expected: exit code 0. (If `rpc` argument names error, re-run `npm run db:types` — names must match the SQL parameters `p_username`, `p_ip`, `p_success`.)

- [ ] **Step 3: Checkpoint (owner commits)**

Suggested: `feat(auth): signup, username login with rate limiting, logout, password reset actions`

---

### Task 11: Auth pages and confirm route

**Files:**
- Create: `web/src/app/(auth)/layout.tsx`, `web/src/app/(auth)/login/page.tsx`, `web/src/app/(auth)/signup/page.tsx`, `web/src/app/(auth)/forgot-password/page.tsx`, `web/src/app/(auth)/check-email/page.tsx`, `web/src/app/reset-password/page.tsx`, `web/src/app/auth/confirm/route.ts`

- [ ] **Step 1: Install shadcn/ui primitives**

```bash
cd /d/plan/web && npx shadcn@latest init -d && npx shadcn@latest add button input label dialog command
```
Expected: components created under `src/components/ui/`.

- [ ] **Step 2: Auth layout**

Create `web/src/app/(auth)/layout.tsx`:
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-center text-2xl font-semibold tracking-tight">Plan</h1>
        {children}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Login page**

Create `web/src/app/(auth)/login/page.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, type AuthState } from '../actions'

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, { error: null })
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" autoComplete="username" autoCapitalize="none" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Logging in…' : 'Log in'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/forgot-password">Forgot password</Link> · <Link href="/signup">Sign up</Link>
      </p>
    </form>
  )
}
```

- [ ] **Step 4: Signup page**

Create `web/src/app/(auth)/signup/page.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signup, type AuthState } from '../actions'

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, { error: null })
  const [timezone, setTimezone] = useState('UTC')
  useEffect(() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone), [])

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="timezone" value={timezone} />
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" autoComplete="username" autoCapitalize="none" required />
        <p className="text-xs text-muted-foreground">3–20 characters: lowercase letters, digits or _</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Recovery email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        <p className="text-xs text-muted-foreground">Used only to reset your password.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        <p className="text-xs text-muted-foreground">At least 10 characters. Longer is stronger.</p>
      </div>
      {state.error && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Creating account…' : 'Sign up'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Have an account? <Link href="/login">Log in</Link>
      </p>
    </form>
  )
}
```

- [ ] **Step 5: Forgot-password page**

Create `web/src/app/(auth)/forgot-password/page.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { requestPasswordReset, type AuthState } from '../actions'

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, { error: null })
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Recovery email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      {state.notice && <p role="status" className="text-sm text-muted-foreground">{state.notice}</p>}
      <Button type="submit" className="w-full" disabled={pending}>Send reset link</Button>
      <p className="text-center text-sm text-muted-foreground"><Link href="/login">Back to log in</Link></p>
    </form>
  )
}
```

- [ ] **Step 6: Check-email page**

Create `web/src/app/(auth)/check-email/page.tsx`:
```tsx
import Link from 'next/link'

export default function CheckEmailPage() {
  return (
    <div className="space-y-4 text-center">
      <p>Check your inbox and confirm your email to finish creating your account.</p>
      <p className="text-sm text-muted-foreground"><Link href="/login">Back to log in</Link></p>
    </div>
  )
}
```

- [ ] **Step 7: Reset-password page (requires the recovery session)**

Create `web/src/app/reset-password/page.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updatePassword, type AuthState } from '../(auth)/actions'

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, { error: null })
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form action={action} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Set a new password</h1>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        </div>
        {state.error && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">{state.error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>Save password</Button>
      </form>
    </main>
  )
}
```

- [ ] **Step 8: Email link handler**

Create `web/src/app/auth/confirm/route.ts`:
```ts
import type { EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/domain/auth/safe-next'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNext(searchParams.get('next'))

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) redirect(next)
  }
  redirect('/login?error=link')
}
```

- [ ] **Step 9: Manual check**

```bash
cd /d/plan/web && npm run dev
```
Open `http://localhost:3000` → redirected to `/login`. Sign up as `testuser1` → lands on `/` (still the scaffold's default page until Task 14 — expected). Log out by clearing cookies, log in with `testuser1` → `/`. Wrong password → "Username or password is incorrect."

- [ ] **Step 10: Checkpoint (owner commits)**

Suggested: `feat(auth): login, signup, password recovery pages and email link handler`

---

### Task 12: Capture parser (TDD)

**Files:**
- Create: `web/src/domain/capture/parse-capture.ts`
- Test: `web/src/domain/capture/parse-capture.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/domain/capture/parse-capture.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseCapture } from './parse-capture'

describe('parseCapture', () => {
  it('returns plain text as title with defaults', () => {
    expect(parseCapture('Open RC set 4')).toEqual({
      title: 'Open RC set 4', projectName: null, estimateMinutes: null, energy: null, kind: 'work',
    })
  })
  it('extracts project, estimate and energy tokens anywhere in the text', () => {
    expect(parseCapture('#GMAT Open RC set 4 ~30m !deep')).toEqual({
      title: 'Open RC set 4', projectName: 'GMAT', estimateMinutes: 30, energy: 'deep', kind: 'work',
    })
  })
  it.each([
    ['~1h', 60],
    ['~1h30m', 90],
    ['~45m', 45],
  ])('parses duration %s', (tok, minutes) => {
    expect(parseCapture(`Write draft ${tok}`).estimateMinutes).toBe(minutes)
  })
  it('keeps invalid durations as text', () => {
    expect(parseCapture('Rest ~0m').title).toBe('Rest ~0m')
    expect(parseCapture('Huge ~25h').title).toBe('Huge ~25h')
  })
  it('sets kind speak for !speak', () => {
    const r = parseCapture('Interview answer !speak')
    expect(r.kind).toBe('speak')
    expect(r.energy).toBeNull()
  })
  it('uses only the first token of each type; later ones stay in the title', () => {
    const r = parseCapture('#A #B task ~10m ~20m')
    expect(r.projectName).toBe('A')
    expect(r.estimateMinutes).toBe(10)
    expect(r.title).toBe('#B task ~20m')
  })
  it('collapses whitespace and returns an empty title when only tokens are given', () => {
    expect(parseCapture('   #GMAT   ~30m  ').title).toBe('')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /d/plan/web && npx vitest run src/domain/capture/parse-capture.test.ts
```
Expected: FAIL — `Failed to resolve import "./parse-capture"`.

- [ ] **Step 3: Implement**

Create `web/src/domain/capture/parse-capture.ts`:
```ts
export type Energy = 'deep' | 'shallow' | 'admin'
export type TaskKind = 'work' | 'speak'

export interface ParsedCapture {
  title: string
  projectName: string | null
  estimateMinutes: number | null
  energy: Energy | null
  kind: TaskKind
}

const PROJECT = /^#([\w-]{1,40})$/
const DURATION = /^~(?:(\d{1,2})h)?(?:(\d{1,4})m)?$/
const ENERGY: Record<string, Energy> = { '!deep': 'deep', '!shallow': 'shallow', '!admin': 'admin' }
const MAX_MINUTES = 1440

function parseDuration(token: string): number | null {
  const m = DURATION.exec(token)
  if (!m || (m[1] === undefined && m[2] === undefined)) return null
  const minutes = Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)
  return minutes >= 1 && minutes <= MAX_MINUTES ? minutes : null
}

export function parseCapture(raw: string): ParsedCapture {
  let projectName: string | null = null
  let estimateMinutes: number | null = null
  let energy: Energy | null = null
  let kind: TaskKind = 'work'
  const words: string[] = []

  for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
    const project = PROJECT.exec(token)
    if (project && projectName === null) {
      projectName = project[1] ?? null
      continue
    }
    if (estimateMinutes === null) {
      const minutes = parseDuration(token)
      if (minutes !== null) {
        estimateMinutes = minutes
        continue
      }
    }
    const e = ENERGY[token]
    if (e && energy === null) {
      energy = e
      continue
    }
    if (token === '!speak' && kind === 'work') {
      kind = 'speak'
      continue
    }
    words.push(token)
  }

  return { title: words.join(' '), projectName, estimateMinutes, energy, kind }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /d/plan/web && npx vitest run src/domain/capture/parse-capture.test.ts
```
Expected: PASS (all tests).

- [ ] **Step 5: Checkpoint (owner commits)**

Suggested: `feat(capture): token parser for project, estimate, energy and speak`

---

### Task 13: Hotkey guard (TDD)

**Files:**
- Create: `web/src/lib/hotkeys.ts`
- Test: `web/src/lib/hotkeys.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/hotkeys.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { matchHotkey, type KeyInfo } from './hotkeys'

const key = (k: Partial<KeyInfo>): KeyInfo => ({
  key: 'q', ctrlKey: false, metaKey: false, altKey: false, targetTag: 'BODY', targetEditable: false, ...k,
})

describe('matchHotkey', () => {
  it('maps q to capture outside text fields', () => {
    expect(matchHotkey(key({}))).toBe('capture')
  })
  it.each(['INPUT', 'TEXTAREA', 'SELECT'])('ignores q inside %s', (tag) => {
    expect(matchHotkey(key({ targetTag: tag }))).toBeNull()
  })
  it('ignores q in contenteditable', () => {
    expect(matchHotkey(key({ targetEditable: true }))).toBeNull()
  })
  it('ignores q with modifiers', () => {
    expect(matchHotkey(key({ ctrlKey: true }))).toBeNull()
  })
  it('maps Ctrl+K and Cmd+K to palette, even inside inputs', () => {
    expect(matchHotkey(key({ key: 'k', ctrlKey: true, targetTag: 'INPUT' }))).toBe('palette')
    expect(matchHotkey(key({ key: 'K', metaKey: true }))).toBe('palette')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd /d/plan/web && npx vitest run src/lib/hotkeys.test.ts
```
Expected: FAIL — `Failed to resolve import "./hotkeys"`.

- [ ] **Step 3: Implement**

Create `web/src/lib/hotkeys.ts`:
```ts
export type HotkeyAction = 'capture' | 'palette'

export interface KeyInfo {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  targetTag: string
  targetEditable: boolean
}

const TEXT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function matchHotkey(e: KeyInfo): HotkeyAction | null {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') return 'palette'
  const typing = e.targetEditable || TEXT_TAGS.has(e.targetTag)
  if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'q') return 'capture'
  return null
}

export function keyInfoFromEvent(e: KeyboardEvent): KeyInfo {
  const target = e.target instanceof HTMLElement ? e.target : null
  return {
    key: e.key,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    altKey: e.altKey,
    targetTag: target?.tagName ?? 'BODY',
    targetEditable: target?.isContentEditable ?? false,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /d/plan/web && npx vitest run src/lib/hotkeys.test.ts
```
Expected: PASS.

- [ ] **Step 5: Checkpoint (owner commits)**

Suggested: `feat: global hotkey matcher`

---

### Task 14: Capture action, projects and inbox

**Files:**
- Create: `web/src/domain/projects/colors.ts`, `web/src/app/(app)/capture-actions.ts`, `web/src/app/(app)/projects/actions.ts`, `web/src/app/(app)/projects/project-form.tsx`, `web/src/app/(app)/projects/page.tsx`, `web/src/app/(app)/inbox/page.tsx`, `web/src/app/(app)/page.tsx`

- [ ] **Step 1: Capture Server Action**

Create `web/src/app/(app)/capture-actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { parseCapture } from '@/domain/capture/parse-capture'

export type CaptureResult = { ok: true } | { ok: false; error: string }

export async function captureTask(raw: string): Promise<CaptureResult> {
  const parsed = parseCapture(String(raw ?? '').slice(0, 600))
  if (!parsed.title) return { ok: false, error: 'Write something to capture.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You are signed out. Please log in again.' }

  let projectId: string | null = null
  let title = parsed.title
  if (parsed.projectName) {
    // projects.name is citext → equality is case-insensitive
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('name', parsed.projectName)
      .maybeSingle()
    if (project) projectId = project.id
    else title = `${title} #${parsed.projectName}` // unknown project: keep the tag visible
  }

  const { error } = await supabase.from('tasks').insert({
    title: title.slice(0, 500),
    project_id: projectId,
    estimate_minutes: parsed.estimateMinutes,
    energy: parsed.energy,
    kind: parsed.kind,
  })
  if (error) return { ok: false, error: 'Could not save. Please try again.' }

  revalidatePath('/inbox')
  return { ok: true }
}
```

- [ ] **Step 2a: Project colours (shared constant)**

`'use server'` modules may only export async functions, so the colour list lives in its own module.
Create `web/src/domain/projects/colors.ts`:
```ts
export const PROJECT_COLORS = ['slate', 'teal', 'blue', 'violet', 'rose', 'amber', 'green', 'stone'] as const
export type ProjectColor = (typeof PROJECT_COLORS)[number]
```

- [ ] **Step 2: Projects Server Action**

Create `web/src/app/(app)/projects/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { PROJECT_COLORS } from '@/domain/projects/colors'

const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name the project.')
    .max(40, 'Keep it under 40 characters.')
    .regex(/^[\w-]+$/, 'Use letters, digits, - or _ (so you can tag it with #name).'),
  color: z.enum(PROJECT_COLORS),
})

export type ProjectState = { error: string | null }

export async function createProject(_prev: ProjectState, formData: FormData): Promise<ProjectState> {
  const parsed = projectSchema.safeParse({ name: formData.get('name'), color: formData.get('color') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid project.' }

  const supabase = await createClient()
  const { error } = await supabase.from('projects').insert(parsed.data)
  if (error?.code === '23505') return { error: 'You already have a project with that name.' }
  if (error) return { error: 'Could not create the project. Please try again.' }

  revalidatePath('/projects')
  return { error: null }
}
```

- [ ] **Step 3: Project form (client)**

Create `web/src/app/(app)/projects/project-form.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PROJECT_COLORS } from '@/domain/projects/colors'
import { createProject, type ProjectState } from './actions'

export function ProjectForm() {
  const [state, action, pending] = useActionState<ProjectState, FormData>(createProject, { error: null })
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor="name">New project</Label>
        <Input id="name" name="name" placeholder="GMAT" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="color">Colour</Label>
        <select id="color" name="color" defaultValue="slate" className="h-9 rounded-md border bg-background px-2 text-sm">
          {PROJECT_COLORS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>Add</Button>
      {state.error && <p role="alert" className="w-full text-sm text-amber-700 dark:text-amber-400">{state.error}</p>}
    </form>
  )
}
```

- [ ] **Step 4: Projects page**

Create `web/src/app/(app)/projects/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { ProjectForm } from './project-form'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, color, status')
    .order('created_at', { ascending: true })

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold">Projects</h1>
      <ProjectForm />
      <ul className="divide-y rounded-md border">
        {(projects ?? []).map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <span className="size-2.5 rounded-full" style={{ background: `var(--project-${p.color}, gray)` }} />
            <span>{p.name}</span>
            <span className="ml-auto text-xs text-muted-foreground">{p.status}</span>
          </li>
        ))}
        {projects?.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">No projects yet. Add one above.</li>}
      </ul>
    </section>
  )
}
```

- [ ] **Step 5: Project colour tokens**

Append to `web/src/app/globals.css`:
```css
:root {
  --project-slate: #64748b; --project-teal: #0f766e; --project-blue: #2563eb; --project-violet: #7c3aed;
  --project-rose: #be123c; --project-amber: #b45309; --project-green: #15803d; --project-stone: #78716c;
}
```

- [ ] **Step 6: Inbox page**

Create `web/src/app/(app)/inbox/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'

export default async function InboxPage() {
  const supabase = await createClient()
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, estimate_minutes, energy, kind, projects(name, color)')
    .eq('status', 'inbox')
    .order('created_at', { ascending: false })

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Inbox</h1>
      <p className="text-sm text-muted-foreground">Press <kbd className="rounded border px-1">Q</kbd> to capture.</p>
      <ul className="divide-y rounded-md border" data-testid="inbox-list">
        {(tasks ?? []).map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
            {t.projects && (
              <span className="size-2.5 rounded-full" style={{ background: `var(--project-${t.projects.color}, gray)` }} title={t.projects.name} />
            )}
            <span>{t.title}</span>
            {t.estimate_minutes && <span className="rounded bg-muted px-1.5 text-xs">{t.estimate_minutes}m</span>}
            {t.energy && <span className="rounded bg-muted px-1.5 text-xs">{t.energy}</span>}
            {t.kind === 'speak' && <span className="rounded bg-muted px-1.5 text-xs">speak</span>}
          </li>
        ))}
        {tasks?.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">Inbox clear.</li>}
      </ul>
    </section>
  )
}
```

- [ ] **Step 7: Home (Phase 0 placeholder)**

Create `web/src/app/(app)/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

// Phase 1 replaces this with the Home screen (Now card, timeline).
export default function HomePage() {
  redirect('/inbox')
}
```

Delete the scaffold's `web/src/app/page.tsx` (it conflicts with `(app)/page.tsx`):
```bash
rm /d/plan/web/src/app/page.tsx
```

- [ ] **Step 8: Verify**

```bash
cd /d/plan/web && npm run typecheck && npm run lint
```
Expected: exit code 0. If `t.projects` is typed as an array, regenerate types (`npm run db:types`) — the composite FK makes it a single object.

- [ ] **Step 9: Checkpoint (owner commits)**

Suggested: `feat: capture action, projects and inbox pages`

---

### Task 15: App shell, quick capture dialog, command palette

**Files:**
- Create: `web/src/components/capture/capture-dialog.tsx`, `web/src/components/shell/command-palette.tsx`, `web/src/components/shell/app-shell.tsx`, `web/src/app/(app)/layout.tsx`

- [ ] **Step 1: Capture dialog**

Create `web/src/components/capture/capture-dialog.tsx`:
```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { captureTask } from '@/app/(app)/capture-actions'
import { parseCapture } from '@/domain/capture/parse-capture'

export function CaptureDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const preview = parseCapture(text)

  function submit(keepOpen: boolean) {
    const value = text
    startTransition(async () => {
      const result = await captureTask(value)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setText('')
      setError(null)
      router.refresh()
      if (!keepOpen) onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[20%] translate-y-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Quick capture</DialogTitle>
        <DialogDescription className="sr-only">Type a task and press Enter.</DialogDescription>
        <Input
          autoFocus
          aria-label="Capture"
          placeholder="Open RC set 4 #GMAT ~30m !deep"
          value={text}
          disabled={pending}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit(e.shiftKey)
            }
          }}
        />
        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          {preview.projectName && <span className="rounded bg-muted px-1.5">#{preview.projectName}</span>}
          {preview.estimateMinutes && <span className="rounded bg-muted px-1.5">{preview.estimateMinutes}m</span>}
          {preview.energy && <span className="rounded bg-muted px-1.5">{preview.energy}</span>}
          {preview.kind === 'speak' && <span className="rounded bg-muted px-1.5">speak</span>}
          <span className="ml-auto">Enter to save · Shift+Enter to save and add another</span>
        </div>
        {error && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Command palette**

Create `web/src/components/shell/command-palette.tsx`:
```tsx
'use client'

import { useRouter } from 'next/navigation'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { logout } from '@/app/(auth)/actions'

export function CommandPalette({
  open,
  onOpenChange,
  onCapture,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCapture: () => void
}) {
  const router = useRouter()
  const run = (fn: () => void) => {
    onOpenChange(false)
    fn()
  }
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command…" />
      <CommandList>
        <CommandEmpty>No matching command.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(onCapture)}>Capture a task</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => run(() => router.push('/inbox'))}>Inbox</CommandItem>
          <CommandItem onSelect={() => run(() => router.push('/projects'))}>Projects</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Account">
          <CommandItem onSelect={() => run(() => void logout())}>Log out</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

- [ ] **Step 3: App shell**

Create `web/src/components/shell/app-shell.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CaptureDialog } from '@/components/capture/capture-dialog'
import { CommandPalette } from './command-palette'
import { keyInfoFromEvent, matchHotkey } from '@/lib/hotkeys'
import { logout } from '@/app/(auth)/actions'

const NAV = [
  { href: '/inbox', label: 'Inbox' },
  { href: '/projects', label: 'Projects' },
]

export function AppShell({ username, children }: { username: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const [captureOpen, setCaptureOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      const action = matchHotkey(keyInfoFromEvent(e))
      if (action === 'capture' && !captureOpen && !paletteOpen) {
        e.preventDefault()
        setCaptureOpen(true)
      } else if (action === 'palette') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [captureOpen, paletteOpen])

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="border-b bg-muted/30 px-4 py-3 md:w-56 md:border-b-0 md:border-r md:py-6">
        <nav className="flex gap-4 md:flex-col md:gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded px-2 py-1 text-sm ${pathname.startsWith(n.href) ? 'bg-background font-medium' : 'text-muted-foreground'}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 hidden text-sm text-muted-foreground md:block">
          <p>@{username}</p>
          <form action={logout}>
            <button type="submit" className="mt-1 underline-offset-2 hover:underline">Log out</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-10">{children}</main>
      <button
        type="button"
        onClick={() => setCaptureOpen(true)}
        className="fixed bottom-5 right-5 rounded-full bg-teal-700 px-5 py-3 text-sm font-medium text-white shadow-md md:hidden"
        aria-label="Capture a task"
      >
        + Capture
      </button>
      <CaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onCapture={() => setCaptureOpen(true)} />
    </div>
  )
}
```

- [ ] **Step 4: Authenticated layout**

Create `web/src/app/(app)/layout.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/shell/app-shell'
import { createClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('username').eq('user_id', user.id).single()

  return <AppShell username={profile?.username ?? ''}>{children}</AppShell>
}
```

- [ ] **Step 5: Manual check**

```bash
cd /d/plan/web && npm run dev
```
Log in → `/inbox`. Press `Q`, type `Open RC set 4 ~30m !deep`, Enter → item appears with `30m` and `deep`. Create project `GMAT`, capture `Mock test #gmat` → item shows the project dot. `Ctrl+K` → palette; "Projects" navigates. Expected: all work; no console errors.

- [ ] **Step 6: Checkpoint (owner commits)**

Suggested: `feat: app shell with quick capture (Q) and command palette (Ctrl+K)`

---

### Task 16: PWA manifest and icons

**Files:**
- Create: `web/scripts/make-icons.mjs`, `web/public/icons/icon-192.png`, `web/public/icons/icon-512.png` (generated), `web/src/app/manifest.ts`

- [ ] **Step 1: Icon generator**

Create `web/scripts/make-icons.mjs`:
```js
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
     <rect width="512" height="512" rx="96" fill="#0f766e"/>
     <circle cx="256" cy="256" r="120" fill="none" stroke="#f7f6f3" stroke-width="40"/>
     <circle cx="256" cy="256" r="28" fill="#f7f6f3"/>
   </svg>`,
)

await mkdir('public/icons', { recursive: true })
for (const size of [192, 512]) {
  await sharp(svg).resize(size, size).png().toFile(`public/icons/icon-${size}.png`)
}
console.log('icons written')
```

- [ ] **Step 2: Generate**

```bash
cd /d/plan/web && npm run icons
```
Expected: `icons written`; two PNGs in `public/icons/`.

- [ ] **Step 3: Manifest**

Create `web/src/app/manifest.ts`:
```ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Plan',
    short_name: 'Plan',
    description: 'Train focus, planning and speaking as skills.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f6f3',
    theme_color: '#0f766e',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
```

- [ ] **Step 4: Verify**

`npm run dev`, open `http://localhost:3000/manifest.webmanifest` while logged out. Expected: JSON manifest (not a redirect to `/login`). Chrome DevTools → Application → Manifest shows both icons with no errors.

- [ ] **Step 5: Checkpoint (owner commits)**

Suggested: `feat: PWA manifest and icons`

---

### Task 17: End-to-end tests

**Files:**
- Create: `web/playwright.config.ts`, `web/e2e/helpers.ts`, `web/e2e/auth.spec.ts`, `web/e2e/capture.spec.ts`, `web/e2e/isolation.spec.ts`

- [ ] **Step 1: Playwright config**

Create `web/playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ...(process.env as Record<string, string>), PASSWORD_BREACH_CHECK: 'off' },
  },
})
```

- [ ] **Step 2: Helpers**

Create `web/e2e/helpers.ts`:
```ts
import { expect, type Page } from '@playwright/test'

export function uniqueUser() {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return { username: `u_${id}`.slice(0, 20), email: `${id}@test.dev`, password: 'a-long-test-password' }
}

export async function signUp(page: Page, u = uniqueUser()) {
  await page.goto('/signup')
  await page.getByLabel('Username').fill(u.username)
  await page.getByLabel('Recovery email').fill(u.email)
  await page.getByLabel('Password').fill(u.password)
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page).toHaveURL(/\/inbox$/)
  return u
}
```

- [ ] **Step 3: Auth journey**

Create `web/e2e/auth.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { signUp } from './helpers'

test('sign up, log out, log in with username', async ({ page }) => {
  const u = await signUp(page)
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel('Username').fill(u.username.toUpperCase())
  await page.getByLabel('Password').fill(u.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/inbox$/)
})

test('wrong password shows a generic error', async ({ page }) => {
  const u = await signUp(page)
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.getByLabel('Username').fill(u.username)
  await page.getByLabel('Password').fill('wrong-password-here')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Username or password is incorrect.')
})

test('unknown user gets the same generic error', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Username').fill('nobody_here_123')
  await page.getByLabel('Password').fill('whatever-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Username or password is incorrect.')
})

test('protected pages redirect to login when signed out', async ({ page }) => {
  await page.goto('/inbox')
  await expect(page).toHaveURL(/\/login$/)
})
```

- [ ] **Step 4: Capture journey**

Create `web/e2e/capture.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { signUp } from './helpers'

test('Q opens capture; Enter saves within 2 seconds', async ({ page }) => {
  await signUp(page)
  await page.keyboard.press('q')
  const input = page.getByLabel('Capture')
  await expect(input).toBeFocused()

  // Warm-up capture: the dev server compiles the action on first use; timing is measured on the second.
  await input.fill('Warm-up item')
  await input.press('Shift+Enter')
  await expect(page.getByTestId('inbox-list').getByText('Warm-up item')).toBeVisible({ timeout: 15_000 })

  await input.fill('Open RC set 4 ~30m !deep')

  const started = Date.now()
  await input.press('Enter')
  const item = page.getByTestId('inbox-list').getByText('Open RC set 4')
  await expect(item).toBeVisible({ timeout: 2000 })
  expect(Date.now() - started).toBeLessThan(2000)
  await expect(page.getByTestId('inbox-list').getByText('30m')).toBeVisible()
})

test('Shift+Enter keeps the dialog open for the next item', async ({ page }) => {
  await signUp(page)
  await page.keyboard.press('q')
  const input = page.getByLabel('Capture')
  await input.fill('First thing')
  await input.press('Shift+Enter')
  await expect(input).toHaveValue('')
  await expect(input).toBeVisible()
})
```

- [ ] **Step 5: Isolation journey**

Create `web/e2e/isolation.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { signUp } from './helpers'

test("one user's tasks are invisible to another", async ({ browser }) => {
  const alice = await browser.newContext()
  const bob = await browser.newContext()
  const a = await alice.newPage()
  const b = await bob.newPage()

  await signUp(a)
  await a.keyboard.press('q')
  await a.getByLabel('Capture').fill('Alice private task')
  await a.getByLabel('Capture').press('Enter')
  await expect(a.getByTestId('inbox-list').getByText('Alice private task')).toBeVisible()

  await signUp(b)
  await expect(b.getByTestId('inbox-list')).not.toContainText('Alice private task')

  await alice.close()
  await bob.close()
})
```

- [ ] **Step 6: Run E2E**

```bash
cd /d/plan/web && npx playwright install chromium && npm run test:e2e
```
Expected: `8 passed`.

- [ ] **Step 7: Checkpoint (owner commits)**

Suggested: `test(e2e): auth, capture and isolation journeys`

---

### Task 18: Continuous integration

**Files:**
- Create: `D:\plan\.github\workflows\ci.yml`

- [ ] **Step 1: Workflow**

Create `D:\plan\.github\workflows\ci.yml`:
```yaml
name: CI
on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    env:
      NEXT_PUBLIC_SITE_URL: http://localhost:3000
      PASSWORD_BREACH_CHECK: 'off'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - name: Start Supabase
        run: npx supabase start
      - name: Export Supabase env
        run: |
          STATUS=$(npx supabase status -o json)
          URL=$(echo "$STATUS" | jq -r .API_URL)
          ANON=$(echo "$STATUS" | jq -r .ANON_KEY)
          SERVICE=$(echo "$STATUS" | jq -r .SERVICE_ROLE_KEY)
          for v in "$URL" "$ANON" "$SERVICE"; do
            if [ -z "$v" ] || [ "$v" = "null" ]; then echo "Missing Supabase status value"; exit 1; fi
          done
          echo "NEXT_PUBLIC_SUPABASE_URL=$URL" >> "$GITHUB_ENV"
          echo "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$ANON" >> "$GITHUB_ENV"
          echo "SUPABASE_SECRET_KEY=$SERVICE" >> "$GITHUB_ENV"
      - name: DB tests (RLS)
        run: npx supabase test db
      - name: Generated types are current
        run: |
          npx supabase gen types typescript --local > /tmp/types.ts
          diff -q /tmp/types.ts src/lib/supabase/database.types.ts
      - run: npm run typecheck
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

- [ ] **Step 2: Verify locally what CI runs**

```bash
cd /d/plan/web && npm run lint && npm test && npx supabase test db && npm run typecheck && npm run build && npm run test:e2e
```
Expected: every command exits 0.

- [ ] **Step 3: Checkpoint (owner commits and pushes to GitHub)**

Suggested: `ci: lint, unit, RLS, types, build and e2e on every push`
After pushing, confirm the GitHub Actions run is green.

---

### Task 19: Deploy — Supabase (staging + production) and Vercel

**⚠ Owner approval required before Steps 3 and 7** (changes live databases / auth settings).

- [ ] **Step 1: Create two Supabase projects**

In the Supabase dashboard: `plan-staging` and `plan-prod`, region **South Asia (Mumbai)**. Save each project's ref, URL, publishable key and secret key in a password manager.

- [ ] **Step 2: Link the CLI to staging**

```bash
cd /d/plan/web && npx supabase link --project-ref <staging-ref>
```

- [ ] **Step 3: Push migrations to staging (owner approves)**

```bash
cd /d/plan/web && npx supabase db push
```
Expected: lists the 3 migrations and applies them.

- [ ] **Step 4: Configure staging Auth (dashboard → Authentication)**

- Sign-in providers → Email: enabled; **Confirm email: on**.
- URL Configuration: Site URL = the stable alias of a `staging` branch (e.g. `https://<project>-git-staging-<team>.vercel.app`); Redirect URLs: `https://*-<team>.vercel.app/**`. Email links always use the Site URL, so test recovery/confirmation on the `staging` branch deployment.
- Email templates → **Confirm signup**: link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
- Email templates → **Reset password**: link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`

- [ ] **Step 5: Create the Vercel project**

Vercel → Add New → Project → import the GitHub repo → **Root Directory: `web`** → Framework: Next.js.

Environment variables:

| Variable | Preview (staging) | Production |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | staging URL | prod URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | staging publishable key | prod publishable key |
| `SUPABASE_SECRET_KEY` | staging secret key (mark Sensitive) | prod secret key (mark Sensitive) |
| `NEXT_PUBLIC_SITE_URL` | `staging` branch alias URL | production URL |
| `PASSWORD_BREACH_CHECK` | `on` | `on` |

- [ ] **Step 6: Smoke test a preview deployment**

On the `staging` branch deployment: sign up → confirmation email arrives → link lands logged in → capture with `Q` → log out → log in by username → "Forgot password" email → reset works → second account cannot see the first account's tasks. Expected: all pass.

- [ ] **Step 7: Production (owner approves)**

```bash
cd /d/plan/web && npx supabase link --project-ref <prod-ref> && npx supabase db push
```
Repeat Step 4 for `plan-prod` with the production domain (Site URL = production URL, redirect URL = production URL). Deploy `main` on Vercel and repeat the Step 6 smoke test on production.

- [ ] **Step 8: Phase 0 gate**

Done when: two real accounts sign up and log in on production, each sees only their own data, and capture from any screen takes under 2 seconds. Then write the Phase 1 plan.

---

## Self-review

**Spec coverage (DESIGN.md Phase 0):**
- F1 Quick capture → Tasks 12, 14, 15, 17 · F3 Projects → Tasks 4, 14 · F25 Command palette → Task 15 · F26 PWA → Task 16
- F51 Username + password auth, recovery email, rate limiting, generic errors, breached-password check → Tasks 5, 7, 8, 10, 11, 17
- F52 Per-user isolation (owner_id + RLS, composite FKs) → Tasks 3, 4, 17
- F53 Profile & settings (timezone, day boundary, caps) → Task 3 (timezone captured at signup)
- F54 Social-ready conventions (`visibility`, single `can_read`, UUIDs) → Task 4
- Deployment (Vercel + Supabase, staging/production) → Task 19 · CI gates → Task 18

**Deferred by design:** profile/settings editing UI (Account & Data screen) → Phase 1; "log out of all devices" → Phase 1 settings; live username-availability check while typing → later; storage policies → Phase 4; `login_attempts` cleanup job → Phase 1 (pg_cron).

**Known version-sensitive points (checked at execution time):** Next.js major (Task 1 Step 3: `proxy.ts` vs `middleware.ts`); Supabase key naming (publishable/secret vs anon/service_role — both supported via the same env vars); `supabase status -o json` key names in CI (guarded — the step fails loudly if missing).
