# Plan — web app

Productivity trainer (see `../DESIGN.md`). Next.js 16 on Vercel + Supabase.

## Run locally

Prerequisites: Node 24, Docker Desktop running.

```bash
npm install
npx supabase start          # local Postgres, Auth, API (first run pulls images)
npx supabase status         # copy keys into .env.local (see .env.example)
npx supabase db reset       # apply migrations
npm run dev                 # http://localhost:3000
```

Local `supabase/config.toml` disables Studio, Realtime, Analytics and Edge Runtime to keep memory low.
Storage is on (audio). The latest `storage-api` images (v1.79.33+) ship an empty `package.json`, so pin a working one before `supabase start`:

```bash
mkdir -p supabase/.temp && printf 'v1.79.32' > supabase/.temp/storage-version
```

Reminders: the database scheduler (pg_cron → pg_net) calls `/api/cron/dispatch` every minute. Point it at your app (local example):

```sql
insert into private.app_config (key, value) values
  ('dispatch_url', 'http://host.docker.internal:3000/api/cron/dispatch'),
  ('cron_secret', '<same value as CRON_SECRET>')
on conflict (key) do update set value = excluded.value;
```

## Checks

| Command | What it checks |
|---|---|
| `npm test` | Domain logic (capture, auth, day math, ladder, skills S1–S8, Now card, goal pace, block outcomes, speech metrics) |
| `npm run test:db` | Database security: per-user isolation, cross-user writes, server-only functions |
| `npm run typecheck` · `npm run lint` | Types and lint |
| `npm run build` then `npm run test:e2e` | Browser journeys: auth, daily loop, isolation, goal→calendar→launcher, speaking drill (fake mic) |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` after a migration |

Run these locally before pushing (there is no CI).

## Deploy (owner approval needed for database steps)

1. **Supabase:** create `plan-staging` and `plan-prod` (region Mumbai). For each: `npx supabase link --project-ref <ref>` then `npx supabase db push`. If the push stops at `pg_cron`/`pg_net`, enable both under Database → Extensions and push again.
2. **Supabase Auth settings** (each project): Email provider on, **Confirm email on**; Site URL = the app URL; redirect URLs include it.
   Email templates:
   - Confirm signup → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
   - Reset password → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
3. **Vercel:** import the repo, **Root Directory = `web`**. Env vars per environment (Preview → staging, Production → prod):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (Sensitive), `NEXT_PUBLIC_SITE_URL`, `PASSWORD_BREACH_CHECK=on`,
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (Sensitive), `VAPID_SUBJECT`, `CRON_SECRET` (Sensitive). Generate VAPID keys with `npx web-push generate-vapid-keys` (free).
4. **Scheduler** (each Supabase project, SQL editor): run the `private.app_config` insert above with `dispatch_url = https://<your-domain>/api/cron/dispatch` and the same `CRON_SECRET`.
5. **Partner calls (optional TURN):** calls are direct browser-to-browser and use free public STUN. On strict networks a TURN relay helps — set `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_CREDENTIAL` (free tiers: Cloudflare Realtime TURN, Metered Open Relay). Without them, the in-app call falls back to each partner's saved call link.
6. **Keep-alive:** `vercel.json` schedules a daily Vercel Cron (03:00 UTC) to `/api/cron/keepalive`, which does one real database read so a free Supabase project never pauses for inactivity. It authenticates with the same `CRON_SECRET` (Vercel sends it as a Bearer token automatically). Check it under Vercel → Project → Settings → Cron Jobs.
7. Smoke test: sign up → confirm email → capture (`Q`) → plan day → focus → shutdown → create a goal → place & commit a block → launcher → speaking drill → second account can't see first account's data.

All services used are free: Vercel Hobby, Supabase Free (check storage/egress limits before heavy audio use), browser speech recognition, Web Push, Google Calendar iCal link.

## Layout

```
src/domain/     pure business rules + unit tests (no I/O)
src/lib/data/   server data loaders (viewer, today, skills, lists)
src/app/actions server actions (validated with Zod, authorised per user)
src/app/(app)   shell pages: Home, Inbox, Projects, Skills, Someday, Plan, Shutdown, Settings
src/app/(focus) full-screen Focus Mode and Break
supabase/       migrations + pgTAP security tests
e2e/            Playwright journeys
```
