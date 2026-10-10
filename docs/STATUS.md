# Plan — Status & Handoff

_Last updated: 2026-10-10. Read this first when resuming._

## Where things stand

| Milestone | Status |
|---|---|
| **M1 — Daily driver** (auth, capture, Home + Now card, morning/shutdown rituals, Focus Mode with 5 timer modes + ladder, distraction log, breaks, Skills S1–S6, scaffold & fade, self-direction) | ✅ Built + verified locally |
| **M2 — Plan & speak** (goals + WOOP, calendar/week planner, commit week, commitment ledger + outcomes, S8 Reliability, Promise vs reality, Block Launcher, web push via pg_cron→pg_net→`/api/cron/dispatch`, iCal import, Speaking Studio + S7, export/delete account, offline service worker) | ✅ Built + verified locally |
| **M3 — Training & fun** (weekly review + planning flow, Week Wrapped, weekly outcomes, missions = weekly drill with suggestion biasing, personal records, insight cards, if-then cue cards, done-when, habits, aging queue + kill list, Commitment Ladder, weekly goal confidence forecasts (Brier), daily reflection, fresh-start prompts, baseline re-anchoring, prosody metrics) | ✅ Built + verified locally |
| **M4 — Partner mode** (pair by partner code or invite link, consent-based sharing Exact/Count/Private, presence, "focus together" invites, Pair Room with shared countdown + built-in call, shared weekly quest, common list, reactions, gentle nudges) | ✅ Built + verified locally |
| Later (only if needed) | Groups (same tables as pairs), Google two-way sync |

**Verification at last run (2026-10-09, after M4 partner mode):** unit 67/67 · DB security (pgTAP) 77/77 · E2E 14/14 · lint, typecheck, build clean · generated DB types current.

**Not deployed. Nothing committed** (owner commits manually; `D:\plan` is its own git repo, branch `main`).

## Owner to-dos

1. Commit `D:\plan`.
2. Deploy — steps in `web/README.md` (Supabase staging + prod in Mumbai, `db push`, auth email templates, Vercel root `web`, env vars incl. VAPID + `CRON_SECRET`, scheduler `private.app_config` insert). Needs owner logins + approval.
3. Live-test what can't be tested locally: push notifications, real Google iCal link, email confirm/reset.
4. Use daily ~1 week so skills/ladder/multiplier have data.

## Calendar, friends & guide (2026-10-09 night → 2026-10-10)

Built from the three approved prototypes (owner said "all proceed", with group video up to 4 friends).
- **Calendar** (`docs/mockups/calendar-ui.html`): Day / Week / Month, drag down to create, drag to move, drag the bottom edge to resize, project colours, now line, strong-hours stripes, quick add in plain words ("Biology 4–6pm tomorrow", `domain/calendar/parse-block.ts`), hours-left tray. Keys D/W/M, T, ← →, N. Migration `20261009000010_calendar_subjects.sql`.
- **Friends** (`docs/mockups/friends-ui.html`), migration `20261009000011_friends.sql`: many friends (limit 30) instead of one partner; sharing level set **per friend** (Exact / Count / Private; settings level = default for new friends); Friends page = list (focusing first) + one friend's panel (today, sharing chips, weekly goal together, shared list, cheers, remove); "Focus together" sheet picks 1–4 friends, length and Video / Audio / No call, Enter sends. Several friends → a short-lived "room" group; late accepters join the running room and check in first. Group call = WebRTC mesh (one direct link per person, signals addressed with `to_user`). Sidebar shows up to 3 friends' live status; Home asks "Solo or with friends?". Nav label "Partner" → **Friends** (URL still `/partner`).
- **Study room clock:** while focusing together, everyone sees the same big speedometer clock (the solo focus clock, synced to the server time), with friends as chips underneath; Enter = finish, D = distracted.
- **Study room pass (2026-10-10):** migration `20261010000012_room_call.sql` — **one call type per room**: the inviter picks Video / Audio / No call in the invite sheet (shown on the invite card), there is no per-person "Join with" step any more, and anyone in the room can switch it for everyone ("Sam switched the call to audio"); call signals carry an epoch so a switch reconnects cleanly. The call connects already at check-in. During focus the clock stays big in the middle and videos shrink to a side strip (laptop) or a top strip (phone) — fits one screen. **Shared list in the room**: a "Shared list · N left" button (bottom left) to tick/add items live; check-in "Working on" is grouped into My tasks and each shared list ("shared with Sam"); group rooms show the lists you have with any friend in the room. Enter = I'm ready at check-in.
- **Guide** (`docs/mockups/guide-ui.html`): `/guide` — 12 animated chapters, Enter/→ next, ← back, 1–9 jump, Esc closes back to the screen you came from; "Try it now" links. Round **?** button on every screen and the **?** key open the chapter for that screen; also account menu → How Plan works. Partner chapter rewritten as "Study with friends"; add key corrected to **Q**.
- **Verification (2026-10-10):** unit 73/73 · pgTAP 99/99 · E2E 15/15 (incl. audio call, switching the call for everyone, shared list in the room, a 3-person room) · lint + typecheck + build clean.
- Known limits: the app layout loads `friends_snapshot()` on every page (fine for a few friends; make a lighter names-only call if friend lists grow); mesh calls suit ≤5 people.

## General app + focus clock + Enter everywhere (2026-10-09, evening)

The app is now pitched as a **general study / skill-building** app, not GMAT prep.
- **Focus clock:** the running timer is a 270° speedometer (`components/focus/focus-gauge.tsx`): needle sweeps the minutes, inner ring of 60 dots ticks every second, last 20% = "final stretch", overtime turns purple (+m:ss), open timer counts up in 60-min laps, Guess-the-time hides needle/numbers. Keys: **Space** pause · **Enter** done · **P/Q** park a thought · **D** distracted. Before a session: Enter starts, 1–5 pick a timer, Esc closes. After: 1–3 rate, F = task finished, Enter saves.
- **Dials:** `components/ui/mini-dial.tsx` on every Today task card (time spent vs estimate; live while running), in the timer bar, and a day dial in the Today header (focused today vs daily target).
- **Enter everywhere:** shared hook `lib/client/use-step-keys.ts` (Enter next, Esc back, number keys pick; Enter also works on focused choice buttons) used by first-run setup, Plan my day, Close the day, New goal, Weekly review, Process inbox and the timer chooser. Key hints (`components/ui/kbd.tsx`) show on pointer devices only.
- **First-run setup (4 steps, Enter ×4):** what you're working on (exam / skill / work / creative / habits) → name (creates first project, weekly hours = daily × 6) → time a day → what to train. Changeable in Settings → Essentials.
- **Wording:** examples, placeholders and goal examples come from `domain/setup/work-kind.ts`; goal types shown as Result / Learning / Habit. GMAT/MBA text removed from the UI and built-in speaking prompts.
- Migration `20261009000009_general_setup.sql` (settings.work_kind, settings.daily_focus_minutes, speaking prompt swap) — applied locally.
- **Prototypes (now built — see the section above):** `docs/mockups/calendar-ui.html` (Day/Week/Month, drag-to-create, resize, subject colours, now line, strong-hours stripes, quick add in plain words, hours-left tray) and `docs/mockups/guide-ui.html` (12-chapter visual "How Plan works" guide, Enter to advance, opened from a ? button on each screen). Focus-clock prototype: `docs/mockups/clock-ui.html` (approved, implemented).
- Held for a later pass: floating (picture-in-picture) timer, subject colours, spaced "review again in 1/3/7 days".
- **No dropdowns left:** all 24 native `<select>`s replaced via `components/ui/choice.tsx` — chips (≤6 options), `HourStepper`, `NumberStepper`, and a searchable pick sheet for long lists (project/goal/task/timezone).
- **Friends prototype:** `docs/mockups/friends-ui.html` (friends list, per-friend sharing, focus together with several friends, group study room). Today partner mode allows exactly one partner; 1-to-1 video/audio call is built (WebRTC P2P, STUN; TURN optional at deploy).
- **Verification (2026-10-09 late):** unit 70/70 · pgTAP 77/77 · E2E 14/14 · lint + typecheck clean. E2E tests updated for the new setup, goal labels and exact button names.

## M3 notes

- Migration `20261009000006_training.sql` (applied locally with `supabase migration up`; no reset needed).
- New screens: `/review` (9-step flow), `/habits`, `/aging` (queue + kill list). Home shows the mission line, cue cards, habits, PR moment, fresh-start/aging prompts. Skills shows pattern cards + records.
- Review timing: Fri–Sun plans **next** week (reviewing this one); Mon–Thu plans the current week (reviewing last week). Only finished weeks resolve forecasts or drive Commitment Ladder suggestions.
- Re-anchoring: after 56 days the first 28 days become the baseline (Competent = 10% better, Strong = 30% better); toggle in Settings → Training. Speaking keeps its composite band.
- Prosody (pitch/volume variety) is computed in the browser from the take; not verified against real voices yet.
- Fixed M2 gaps: blocks outside the day window now widen the calendar grid; Starter now lives in the aging queue.

## UI v0.6 — simple, rich-but-calm, no-scroll (2026-10-09)

Built from the approved prototype (`docs/mockups/new-ui.html`) across the real app:
- Navigation: **Today · Plan (Week, Goals, Lists → Ideas/Projects/Maybe later/Decide, My promises) · Progress (Overview, Weekly review, Habits, Speak) · Partner**; Settings + "My day at a glance" in the account menu; phone bar Today · Plan · ＋ · Progress · Partner.
- Today: greeting + progress ring, one banner at most (daily Solo/Pair, Guide suggestion, cue, budgeted prompt, next block), add box straight onto Today (typed or spoken; ideas as one-tap chips), task cards with ▶ (starts the suggested timer at once; Guess-the-time asks for the guess first), ⚙ timer cards, ✓ done, inline countdown; four tiles (Mission, Habits, Next block/Plan, Speak/Close the day/Plan my day).
- Timer bar on every screen (Open / ✓ Done). Focus screen calm (radial dark), "Got distracted / Park a thought / Pause / I'm done", ← Today; after-session 🎉 + 😄/🙂/😕 + optional "task finished" / "note for next time".
- Plain words everywhere; "Commit week" → **Lock in my week**; first small step optional; default timer respects a typed estimate.
- Progress overview: mission card, 8 skill tiles in everyday words, personal best + top pattern — fits one desktop screen. Calendar day fits one screen. Welcome (login/sign-up) is a two-panel card.
- Visual checks: `scripts/ui-shots.mjs` screenshots pages at desktop/phone sizes and reports vertical overflow; `scripts/ui-flow.mjs` walks ▶ → focus → Today (running) → Done.

## M4 — Partner mode (2026-10-09)

- Migration `20261009000008_partners.sql`: groups/group_members (a pair is a group of two — groups later reuse it), partner codes (`PLN-XXXXX`, regenerable), requests/blocks, invite links (7 days, single use), presence heartbeat, session invites (30 min expiry, snooze, held during focus), co_sessions + members (shared state machine), call signalling rows, reactions, shared lists. Partners read each other only via security-definer functions that apply the sharing level; base tables stay owner-only.
- Consent: default sharing **Count** ("3 planned · 2 done"), Exact shows titles, Private shows nothing; any task can be hidden from its menu. Online status and invites have their own switches. Calls are opt-in per session. Leaving stops all sharing instantly.
- Flow: Partner page (code / invite link) → request → Accept (bell or page). Daily one-tap "Solo or with <partner>?" on Home (only when paired). Invite sheet (50 min default) → partner gets a small card (Join now · In 10 min · Later · Not today), held while they focus, pushed when they're away → accepting finishes any running solo session (counted) and offers to resume it afterwards → Pair Room: check-in (prefilled) → Video / Audio / No call → synchronized 3-2-1 (server clock) → focus (mics muted) → private review + shared check-out → break together → Another round?
- Live updates poll Supabase directly from the browser (no Vercel invocations; Realtime can replace it later). Calls are WebRTC peer-to-peer with STUN; optional TURN via env; the saved call link is the fallback.
- "Hold audio": speaking takes are no longer uploaded unless Settings → Speaking → "Keep the audio of my takes" is on (listen-back still works during the drill; metrics/transcripts always saved).
- Bugs found while testing: call candidates were never sent (a Supabase query fired with `void` never runs) and the answering side could answer before its mic was attached (one-way audio) — both fixed; verified by an E2E test where two browsers connect an audio call.

## Balance & action pass (2026-10-09)

Principle agreed with the owner: **1 recommended action + 2–3 visible alternatives + everything reachable** — nothing hidden or locked, nothing forced.

- **Home** = Now card · at most one extra card (due cue > budgeted prompt > next block > speaking emphasis) · Today list · one quiet "More for today" row (progress line, mission, habits, timeline, day fit, leftovers).
- **Onboarding** asks what to train (focus / planning & goals / speaking / habits). It only sets emphasis; all sections stay visible. Changeable in Settings → Essentials.
- **Feature invitations** instead of unlocks (weekly review after week 1, first goal, first habit, speaking baseline), each offered once with "Not now".
- **Settings**: Essentials (what you're training, coach voice, theme, notifications) up top; everything else under an expandable "Advanced".
- **Skills**: every calibrating skill shows the one action that feeds it.
- **New actions (no AI, no new pages):** Run my Today list (chained sessions) · capture with dates/times ("tomorrow 3pm", "next fri") + mic dictation via browser speech recognition · Hide until… (Things-style) · phone guard (asks what pulled you after leaving the screen; on by default on phones only) + DND in launcher checklist · Ctrl+K finds and acts on tasks · Re-flow the rest of today (rule-based preview, you confirm) · "Next in N min" ring with one chime · optional live filler tick · optional brown noise in focus.
- Migration `20261009000007_balance_actions.sql` (tasks.hidden_until, settings.focus_areas/onboarded_at, checklist default).
- Checks: an E2E test fails if any main screen shows more than one highlighted main button; Home → running timer stays 2 taps.

Bugs found while doing this: the command palette crashed the page as soon as you typed (missing cmdk root — present since M1); rapid captures / Shift+Enter "save & next" lost focus because the box was disabled during refresh; "Run my list" kept the previous session's screen when moving to the next task. All fixed. The long-standing "E2E flake" was a test assuming the Focus Ladder while ~1 in 3 tasks gets Blind Estimate — fixed in the test.

## Navigation (2026-10-09)

Compacted to five sections — Home · Tasks (Inbox, Projects, Later, Decide) · Plan (Calendar, Goals, Promise vs reality) · Speak · Progress (Skills, Weekly review, Habits). Section pages show as quiet tabs; Settings and Log out live in the account menu. Phone bar: Home · Plan · ＋ · Tasks · More (Speak, Progress, What’s left, Settings, Log out). All URLs and G-shortcuts unchanged. Daily Vercel Cron keep-alive stops the free Supabase project from pausing.

## Bug sweep (2026-10-09)

Fixed: export and goal-time reads silently capped at 1000 rows (now paged); task-time lookups with hundreds of ids could exceed the URL limit and silently drop the multiplier (now chunked); outcome finalisation used an unordered capped scan that would stall after ~500 committed blocks; logout left the browser subscribed to the previous user's push (now unsubscribes; "log out of all devices" removes all subscriptions); settings couldn't enable push on a second device; cancelled blocks could be launched; scheduling a task from the aging queue didn't reset its age.

Known, not fixed (low risk): login timing differs for unknown usernames (username enumeration by timing — usernames are already discoverable at signup); offline-cached pages remain on a device if a session expires without logging out.

## Rules agreed with the owner

- **No CI** — removed 2026-10-10 (15 min per push not worth it); run the checks locally before pushing.

- **Free services only** — skip anything paid (no paid transcription; browser speech recognition instead).
- **No AI features** — the user does the thinking; Guide is rule-based and fades as skills grow.
- **Lean testing** — build each milestone in one pass, test once at the end (security, core logic, one E2E per journey).
- Remote database changes and deploys need owner approval. Don't commit.

## Environment notes (gotchas)

- Next.js **16.4**: `cacheComponents: false`; middleware is `src/proxy.ts`; read `web/node_modules/next/dist/docs` before using new APIs.
- shadcn now generates **Base UI** components (no `asChild`; `render` prop). Zod 4. Supabase CLI 2.120 (publishable/secret keys).
- `storage-api` images v1.79.33+ ship an empty `package.json` → pin `v1.79.32` via `web/supabase/.temp/storage-version` (CI does this too).
- Local stack has Studio/Realtime/Analytics/Edge Runtime disabled to save RAM. PC RAM is tight; another project's containers (`backend-postgres-1`, `backend-redis-1`) compete for memory.
- Local scheduler target is set in DB: `private.app_config` (`dispatch_url` = `http://host.docker.internal:3000/api/cron/dispatch`, `cron_secret` = value in `web/.env.local`). Re-run that insert after `supabase db reset`.
- Resume commands (in `D:\plan\web`): `npx supabase start` → `npm run dev` · stop with `npx supabase stop`.

## Key files

- Spec: `DESIGN.md` (v0.5) · Roadmap: `docs/superpowers/plans/2026-10-08-00-master-roadmap.md` (§5 milestone status)
- App: `web/` — `src/domain` (pure logic + tests), `src/lib/data` (loaders), `src/app/actions` (server actions), `supabase/migrations` (5), `supabase/tests/database`, `e2e/`
