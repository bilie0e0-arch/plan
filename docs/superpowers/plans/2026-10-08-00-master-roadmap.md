# Plan App — Master Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each phase plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the app specified in `DESIGN.md` (v0.5) phase by phase, deployed on Vercel (Next.js) + Supabase (Postgres, Auth, Storage, scheduled jobs), with quality gates that catch defects before they reach production.

**Architecture:** One Next.js (App Router, TypeScript) application deployed on Vercel serves both UI and server logic (Server Components, Server Actions, Route Handlers). Supabase provides Postgres with row-level security, password auth, private file storage, and scheduled jobs. All business rules live in pure, I/O-free TypeScript modules under `src/domain/` so they can be unit-tested with injected clocks.

**Tech Stack:** Next.js 16, React 19, TypeScript (strict), Tailwind CSS v4, shadcn/ui, Zod, `@supabase/ssr` + `@supabase/supabase-js` v2, Supabase CLI (local Docker stack), Vitest, pgTAP (`supabase test db`), Playwright, GitHub Actions.

---

## 1. Deployment architecture (confirmed)

```
                ┌──────────────────────── Vercel ────────────────────────┐
 Browser/PWA ──▶│ Next.js app                                            │
                │  • UI (Server + Client Components)                     │
                │  • Server Actions / Route Handlers (auth, capture, …)  │
                │  • Proxy (session refresh, route protection)           │
                └───────────────┬────────────────────────────────────────┘
                                │ HTTPS (supabase-js)
                ┌───────────────▼──────────────── Supabase ──────────────┐
                │ Postgres + RLS  │ Auth (password) │ Storage (audio)     │
                │ pg_cron + Edge Functions (prompts, snapshots, push)     │
                └─────────────────────────────────────────────────────────┘
 External (later phases): Web Push (VAPID) · Google Calendar API (Phase 3) · Transcription provider (Phase 4)
```

| Concern | Where it runs | Why |
|---|---|---|
| Pages, UI | Vercel (Next.js) | Native Next.js hosting, preview deploy per branch |
| Server logic (validation, auth flows, writes) | Vercel (Server Actions) | Same codebase, typed end-to-end |
| Data, access control | Supabase Postgres + RLS | Isolation enforced in the database, not only in app code |
| Login / sessions / password reset | Supabase Auth | No hand-rolled password storage |
| Audio files | Supabase Storage (private bucket) | Per-user path policies, signed URLs |
| Scheduled work (block heads-ups, escalation, weekly snapshots, push) | Supabase `pg_cron` → Edge Function | Minute-level scheduling independent of Vercel plan cron limits |

**Plan-tier notes (verify current terms before launch):**
- Vercel **Hobby** is for personal, non-commercial use. If other people use the app as a product, move to **Pro**.
- Supabase **Free** projects pause after a period of inactivity and have storage/egress limits. Daily personal use generally avoids pausing; for real multi-user use, move to **Pro**. Check current limits before Phase 4 (audio storage).

## 2. Environments

| Environment | Frontend | Database | Used for |
|---|---|---|---|
| **Local** | `npm run dev` (localhost:3000) | Supabase CLI local stack (Docker Desktop) | Development, unit/DB/E2E tests |
| **Preview** | Vercel preview deployment per branch/PR | Supabase **staging** project | Reviewing changes before production |
| **Production** | Vercel production (main branch) | Supabase **production** project (region: Mumbai `ap-south-1`) | Real use |

Preview must **never** point at the production database.

## 3. How we keep bugs out

**Working mode: lean.** Build each phase in one pass and test once at the end. Tests are reserved for where bugs are costly: data isolation between users (RLS), core domain logic, and one end-to-end smoke journey per phase. No per-task test ceremony, no chasing 100% — the bar is a working, safe result at the end of each phase.

The gates below run once per phase (and automatically in CI on push):

| Gate | What it catches | Enforced by |
|---|---|---|
| **TypeScript strict + generated DB types** | Wrong column names, null handling, shape mismatches | `npm run typecheck`; `db:types` regenerated after every migration, CI fails if stale |
| **Zod validation at every boundary** | Bad user input, malformed form data | All Server Actions parse input before use |
| **TDD for domain logic** | Wrong rules (parsing, metrics, pace, outcomes, ladders, Guide rules) | Vitest; failing test written first; clocks injected, never `Date.now()` inside domain code |
| **pgTAP RLS tests for every table** | Data leaking between users, cross-user writes | `supabase test db`; every new table ships with a two-user isolation test |
| **E2E tests per user journey** | Broken flows across UI ↔ server ↔ DB | Playwright against local stack |
| **CI on every push** | Regressions | GitHub Actions: lint → typecheck → unit → DB tests → types-current check → E2E |
| **Preview deployments** | Environment/config issues | Vercel preview + staging DB, manual smoke test |
| **Forward-only, reviewed migrations** | Destructive schema changes | Migrations applied locally + CI first; applied to staging, then production **only with owner approval** |
| **Phase gate** | Building on top of unused or broken features | Next phase plan is written only after the previous phase meets its "done when" in real daily use |

**Coding rules for every phase**
1. Business rules go in `src/domain/**` as pure functions with tests next to them (`*.test.ts`).
2. Server Actions: parse with Zod → authorize via `supabase.auth.getUser()` → call domain → write → `revalidatePath`.
3. Every table: `owner_id` default `auth.uid()`, RLS enabled, select via `public.can_read(...)`, write policies owner-only, index on `owner_id`.
4. Child tables reference parents with composite FKs `(parent_id, owner_id)` so a user cannot attach rows to another user's records.
5. Time: store `timestamptz`; compute "day" using the user's timezone + day boundary in domain code.
6. No secrets in client code; the secret key is imported only from `server-only` modules.
7. Git: the owner commits manually. Plans list suggested commit messages at checkpoints.

## 4. Repository layout

```
D:\plan\
  DESIGN.md
  docs\superpowers\plans\        ← this roadmap + per-phase plans
  .github\workflows\ci.yml
  web\                           ← Next.js app (Vercel Root Directory = web)
    src\app\                     ← routes
    src\components\              ← UI components
    src\domain\                  ← pure business logic + unit tests
    src\lib\                     ← env, Supabase clients, utilities
    supabase\migrations\         ← SQL migrations
    supabase\tests\database\     ← pgTAP tests
    e2e\                         ← Playwright tests
```

## 5. Milestones (current structure — supersedes the phase-by-phase gating below)

Owner decision: build in 3 milestones, feature by feature (DB + logic + UI together), no blocking week-long waits; real use of one milestone feeds the next.

| Milestone | Old phases | Status |
|---|---|---|
| **M1 — Daily driver** | 0 + 1 + 2 | ✅ Built 2026-10-08, verified locally (unit 25/25, DB security 20/20, E2E 3/3, build clean). Not yet deployed. |
| **M2 — Plan & speak** | 3 + 4 | ✅ Built 2026-10-09, verified locally (unit 39/39, DB security 34/34, E2E 5/5 ×2 runs, build clean). Free-only: browser speech recognition (no paid transcription), Google iCal link (no OAuth), Web Push. Not yet deployed. |
| **M3 — Training & fun** | 5 + 6 | ✅ Built 2026-10-09, verified locally (unit 61/61, DB security 50/50, E2E 7/7, build clean). Weekly review/planning, missions, Week Wrapped, PRs, insights, habits, aging queue, Commitment Ladder, Brier forecasts, re-anchoring, prosody. Not yet deployed. |
| Later | 7 + 8 | Pairs/groups, Google two-way sync |

**M2 known limits:** Web Push delivery not tested end-to-end in a real browser (needs a deployed HTTPS origin); iCal import not tested against a live Google link; browser speech recognition drops “um/uh” and only works in Chrome/Edge; blocks outside the day window aren't drawn on the grid; the earlier “E2E flake” was a test assuming the Focus Ladder while ~1 in 3 tasks gets Blind Estimate (fixed 2026-10-09).

**M1 known limits:** offline support covers capture and a running timer (queued/derived from timestamps), not loading the app with no connection (no service worker yet); baseline-week ladder calibration needs 7 days of real data; Storage/Studio/Realtime are disabled in local config to save memory.

## 5b. Phase plans (reference)

Each phase gets its own detailed, task-by-task plan file. Phase 0 is written now; each later plan is written when the previous phase passes its gate, so it can account for what real use revealed.

| Phase | Plan file | Scope (DESIGN.md §16) | Key domain modules (TDD) | Key DB work (with RLS tests) | Done when |
|---|---|---|---|---|---|
| **0 Foundation** | `2026-10-08-01-phase-0-foundation.md` ✅ | Scaffold, username/password auth, recovery, rate limiting, per-user RLS, `can_read`, projects, quick capture, shell, command palette, PWA, CI, deploy | capture parser, auth validation, breached-password check, safe redirect, hotkeys | profiles, settings, projects, tasks, login_attempts, auth RPCs | Two users sign up/log in, each sees only own data; capture < 2 s |
| **1 Daily loop + Guide basics** | written after Phase 0 gate | Inbox triage, morning/shutdown rituals, Home + Now card (rule engine), What's Left (day), timer engine + session protocol, Focus Ladder, distraction ledger, breaks, re-entry, Done Wall, baseline week, energy check-in, prompt budget, coach tones, offline capture/timer | day boundary, Now-card rules, ladder state machine, session clean/outcome rules, prompt budget | day_plans, sessions, distractions, breaks, ladder_state, guide_prompts, nba_events, coach_settings | 7 days of use; ≥ 15 sessions with protocol |
| **2 Skills** | after Phase 1 gate | Estimates/actuals, Blind Estimate, Starter, Timebox, multiplier, attention budget, S1–S6, Skills screen, scaffold & fade controller, self-direction rate | multiplier, skill metrics + bands (2-week stability), fade levels, self-direction rate | skill_snapshots, decision_events, weekly snapshot job (pg_cron) | S1–S6 values with ≥ 2 weeks data |
| **3 Goals, Calendar, Commitments** | after Phase 2 gate | Goals + WOOP, pace engine, calendar + blocks, week planning, capacity rule, recurring blocks, commit & freeze, outcomes, reports, S8, Block Launcher, escalation, replanning, gap filler, Google read-only, Web Push | pace engine, block outcome rules, capacity, recurrence expansion, escalation schedule, gap detection | goals, milestones, calendar_blocks, commitments (immutable), commitment_revisions, block_outcomes; push subscriptions; pg_cron + Edge Function | Two committed weeks; committed vs actual per goal; S8 has value |
| **4 Speaking Studio** | after Phase 3 gate | Recorder, drills, prompt bank, listen-back gate, blind self-rating, metrics, retakes, then-vs-now, filler profile, S7, data controls, export | speech metrics from transcript (fillers, WPM, pauses, hedges), rubric, calibration gap | speaking_prompts, recordings, transcripts, speech_metrics, speech_self_ratings; private Storage bucket + policies | ≥ 3 baseline + ≥ 10 drills; S7 visible |
| **5 Training loop & fun** | after Phase 4 gate | Weekly review + planning flow, outcomes, missions, Week Wrapped, PRs, insights, if-then cues, habits, aging queue, kill list, Commitment Ladder, confidence forecasts | mission progress, PR detection, insight rules, commitment ladder, Brier score | outcomes, missions, personal_records, habits, goal_confidence | One mission week; two reviews |
| **6 Refinement** | after Phase 5 gate | Fresh-start prompts, baseline re-anchoring, prosody metrics | re-anchoring, prosody | — | 8 weeks of data |
| **7 Pairs & groups** | after Phase 6 gate | Groups, shares, peer review, co-focus, speaking circles, group goals | share permission rules | groups, group_members, shares, feedback; `can_read` extended | One pair, 2 weeks of peer review |
| **8 Extensions** | if needed | Google Calendar two-way | — | — | Real need |

## 6. Owner approvals required

| Action | Why approval |
|---|---|
| Creating Supabase staging/production projects | Accounts, region, billing |
| `supabase db push` to staging or production | Changes a live database |
| Changing Supabase Auth settings / email templates | Affects real sign-ins |
| Adding paid services (transcription, plan upgrades) | Cost |
| Git commits / pushes | Owner commits manually |
