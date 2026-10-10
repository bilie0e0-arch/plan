# Plan — Initial Design Document

> A productivity **trainer**, not a tracker. Every timer, metric, recording and screen exists to make you measurably better at focusing, estimating, starting, planning, delivering, keeping commitments and speaking — and an active guide walks you through it.
> Status: **Design v0.5** (pre-implementation) · Date: 2026-10-08 · Owner: Harshit

### Changelog
- **v0.6** — UI/UX for everyone ("a kid should understand it"): rich-but-calm palette (warm paper, one teal main colour, soft area tints), friendly rounded type, plain words (Grow my focus · Guess the time · Just 5 minutes · Set time · Open timer; Ideas · Maybe later · Decide · My promises), four sections (Today · Plan · Progress · Partner), add-a-task box straight onto Today, ▶ on every task with the countdown on the task and a timer bar on every screen, timer choices as cards instead of dropdowns, calm focus screen with a small celebration and one-tap 😄/🙂/😕 review, Solo/Pair always one tap away, screens fit without scrolling where possible. The first-small-step prompt is now optional (suggested, never blocking). Partner mode (M4) added: codes/invite links, consent-based sharing (Exact/Count/Private), presence, focus-together invites, Pair Room with shared countdown and built-in call.
- **v0.5** — Removed all AI features (AI Coach, AI review draft, AI structure check): productivity is developed by doing it yourself, not by having it done for you. Added **Scaffold, then fade** — the Guide's help shrinks as each skill improves — and the **self-direction rate** metric. Now card, placement and replanning changed from "app decides" to "you decide, app checks".
- **v0.4** — Added Goals, Calendar & Commitment Ledger (§9): multiple typed goals with WOOP, pace engine, time blocking, frozen commitments, committed-vs-actual at every level, Commitment Ladder, new skill S8 Reliability. Added The Guide (§10): app becomes active — Next-Best-Action Now card, guided rituals, Block Launcher, start escalation, What's Left panel, proactive replanning, prompt budget, missions, personal records, Week Wrapped, coach tones, optional AI coach. Principles, psychology, phases, data model, UI and metrics updated.
- **v0.3** — Added Speaking Studio (voice recording, listen-back, auto speech metrics, skill S7). Added multi-user accounts (username + password), per-user data isolation, and social-ready architecture for future pair/group learning. Added gap-closing features: baseline week, energy check-in, outcome scoring, offline-first sync, data controls, per-user timezone. Sections 7–8 inserted; later sections renumbered.
- **v0.2** — Repositioned from tracker to skill-development tool. Added Skill Engine (6 trainable skills), Timer System (5 modes + session protocol), distraction ledger, weekly drill, Skills screen. Redesigned Focus Mode. Data model, phases, metrics and anti-features updated accordingly.
- **v0.1** — Initial design.

---

## Table of Contents

1. [What the Application Is](#1-what-the-application-is)
2. [Design Principles](#2-design-principles)
3. [Psychology Foundation](#3-psychology-foundation)
4. [Reference Apps — What We Take, What We Reject](#4-reference-apps--what-we-take-what-we-reject)
5. [Skill Engine](#5-skill-engine)
6. [Timer System](#6-timer-system)
7. [Speaking Studio](#7-speaking-studio)
8. [Accounts, Multi-User & Social-Ready Architecture](#8-accounts-multi-user--social-ready-architecture)
9. [Goals, Calendar & Commitments](#9-goals-calendar--commitments)
10. [The Guide — Active, Interactive Layer](#10-the-guide--active-interactive-layer)
11. [Feature Catalogue](#11-feature-catalogue)
12. [UI Design](#12-ui-design)
13. [Screen-by-Screen Specification](#13-screen-by-screen-specification)
14. [Data Model](#14-data-model)
15. [Tech Stack](#15-tech-stack)
16. [Build Phases](#16-build-phases)
17. [Success Metrics](#17-success-metrics)
18. [Anti-Features (Deliberately Not Built)](#18-anti-features-deliberately-not-built)
19. [Decisions & Defaults](#19-decisions--defaults)

---

## 1. What the Application Is

### One line
An **active coach-like** planning, focus, goal and speaking-practice app that **trains productivity and communication as measurable skills** — using your own work as the practice material — across several parallel life projects. Each user has a private account; the architecture is ready for pair and group learning later.

### Tracker vs trainer

| A tracker… | This app… |
|---|---|
| Records how long you worked | Sets a focus length at the edge of your current capacity and raises it as you improve |
| Stores your estimate | Hides the clock, then shows you your estimation error and its direction |
| Shows a list of overdue tasks | Detects avoided tasks and runs a 5-minute starter drill on them |
| Shows charts | Turns each chart into one skill with a level, a trend and a drill |
| Asks "what did you do?" | Asks "what will you have by the end?" before, and "did you?" after |
| Shows a calendar | Freezes what you committed, compares it with what you actually did, and right-sizes your promises |
| Waits to be opened | Tells you the next step, walks you into your blocks, and shows what's left |
| Stores a voice memo | Makes you listen back, rate yourself, then reveals filler rate, pace and pauses — and lets you retake |

**Rule:** if a piece of data does not feed back into improving a skill, it is not collected.

### The problem it solves

| Failure | Why it happens | What this app does instead |
|---|---|---|
| Lists grow forever | Capturing is easy, deciding is not | Aging tasks force a decision; kill list rewards dropping |
| Days are over-planned | Planning fallacy — estimates are optimistic | Trains estimation via blind estimates; warns when the day doesn't fit |
| Hard tasks never start | Vague tasks, no cue, high start cost | First-action gate, if-then cues, Starter drill |
| Focus breaks quickly | Attention capacity is untrained and unmeasured | Focus Ladder — progressive session length based on clean completions |
| Distractions feel random | No record of what interrupts you, or when | Distraction ledger reveals patterns by time, project and type |
| One project silently starves | No view across projects over time | Weekly attention budget with drift bars |
| Restarting after a break is costly | Context lost between sessions | Re-entry note on every pause |
| Streaks collapse into quitting | One miss feels like total failure | "Never miss twice" — single misses are neutral |
| Goals stay wishes | No measurable target, no scheduled time | Typed goals with WOOP, weekly hours, calendar blocks |
| Plans get silently rewritten | No record of what was originally promised | Commitment Ledger: frozen commitments vs actual |
| The app is forgotten after a week | Passive tools rely on willpower to open them | The Guide: Now card, block launcher, guided rituals, What's Left |
| Speaking doesn't improve with use | People rarely hear themselves; self-perception of speech is inaccurate | Record → listen back → self-rate → reveal measured metrics → retake |

### Who it is for
Primary: one person running multiple long-horizon projects (e.g. GMAT prep, writing, trading system, career transition / MBA interviews, side platforms) alongside a job, who wants to get *better* at focused work and spoken communication — not just log activity.
Secondary (future): small pairs or groups who practise together — accountability partners, peer speaking review, speaking circles.

### What it is not
Not a notes app, not a calendar replacement, not a gamified habit app, not a team project manager, not a social network.

---

## 2. Design Principles

1. **Train, don't track.** Every measurement closes a feedback loop on a named skill.
2. **Practice on real work.** Drills run on your actual tasks — no artificial exercises.
3. **One skill at a time.** Each week has one drill focus; everything else runs normally.
4. **Feedback on ability, never on activity.** Levels come from measured performance, not from hours logged or boxes ticked.
5. **You stay in control.** The app suggests and warns; it never silently reshuffles your plan.
6. **Capture in under 2 seconds, decide later.**
7. **Friction on commitment, not on capture.**
8. **Show done, not just undone.**
9. **No shame mechanics.** No red for misses, no streak resets, no guilt notifications.
10. **Calm surface, active guide.** One primary action per screen — and the app always knows and shows the next step, coming to you when a commitment is due.
11. **Keyboard-first, mouse-friendly, phone-capable.**
12. **Earn every feature.** Unused for 2 weeks → cut.
13. **Private by default, social-ready by design.** Every record belongs to one user; nothing is visible to anyone else unless explicitly shared.
14. **Hear yourself before being told.** For speaking (as for estimation), your own judgement comes first, measurement second — the gap between them is the lesson.
15. **Guide, never nag.** Every proactive prompt is earned, actionable in one tap, offers choice, fits a daily budget, and never uses guilt (§10.3).
16. **Promises are records.** What you committed is frozen; plans can change freely, but the original is never overwritten.
17. **You do the thinking.** The app prompts, measures and holds you to your own decisions — it never plans, decides or reflects *for* you. No AI does the work.
18. **Scaffold, then fade.** Guidance is strongest when a skill is new and withdraws as the skill grows. Success = the app becomes less necessary.

---

## 3. Psychology Foundation

Ranked by strength of evidence. Only strong/solid findings drive core features; moderate ones drive supporting features; weak ones are excluded or explicitly marked as experiments the app measures for you.

| # | Principle | Source | Evidence | Applied as |
|---|---|---|---|---|
| P1 | **Implementation intentions** — "If X, then I do Y" substantially raises follow-through | Gollwitzer & Sheeran meta-analysis (94 studies) | Strong | If-then cue field; cue cards |
| P2 | **Planning fallacy** — people underestimate task duration even with past experience | Kahneman & Tversky; Buehler et al. | Strong | Day-fit meter; personal multiplier |
| P3 | **Calibration improves with outcome feedback** — forecasters with prompt, specific feedback become well-calibrated | Weather forecaster studies; Tetlock (Good Judgment Project) | Strong | Blind Estimate timer; estimation skill |
| P4 | **Progress monitoring improves goal attainment** — more so when recorded and reviewed | Harkin et al. 2016 meta-analysis (138 studies) | Strong | Session protocol; skill trends; weekly review |
| P5 | **WIP limits / queueing** — fewer concurrent items → faster completion | Little's Law; Kanban practice | Strong (operations) | Today cap; active project cap |
| P6 | **Deliberate practice** — improvement needs a specific goal, full attention, immediate feedback, and work at the edge of ability | Ericsson et al. | Solid principle; effect size debated (Macnamara et al. 2014) | Skill Engine design; Focus Ladder; weekly drill |
| P7 | **Competence feedback supports intrinsic motivation**; rewards for mere activity can undermine it | Self-Determination Theory (Deci & Ryan); overjustification research | Solid | Ability-based levels; no points/XP |
| P8 | **Progress principle** — visible progress is the top daily motivator | Amabile & Kramer | Solid | Done Wall; wins-first review |
| P9 | **Fresh-start effect** — temporal landmarks boost goal pursuit | Dai, Milkman & Riis | Solid | Monday / month-start reset; weekly drill selection |
| P10 | **Fogg behavior model** — behavior = motivation × ability × prompt | Fogg | Solid | 2-second capture; one-click start |
| P11 | **Concrete next action** — concrete tasks start; abstract ones are deferred | GTD; construal-level theory (Trope & Liberman) | Solid | First-action gate; session goal |
| P12 | **Interruption & resumption cost** — switching back after an interruption costs time and errors | Gloria Mark; Altmann & Trafton | Moderate–solid | Distraction ledger; re-entry note; distraction parking |
| P13 | **What-the-hell effect** — one rule break leads to abandoning the rule | Polivy & Herman | Moderate | Never-miss-twice habits; Focus Ladder steps down gently |
| P14 | **Small commitment lowers start barrier** (foot-in-the-door; "just 5 minutes") | Freedman & Fraser; behavioral activation practice | Moderate | Starter timer |
| P15 | **Energy variation across the day** | Chronobiology literature | Moderate | Energy tags; peak-hour matching; ledger time-of-day patterns |
| P16 | **Attention span is trainable by gradual extension** | Plausible from practice/overload principles; **not well-tested directly** | Emerging | Focus Ladder — treated as a personal experiment; the app reports whether it is working *for you* |
| P17 | **Repeated exposure reduces speaking anxiety** | Exposure-based treatment of public-speaking anxiety (CBT literature) | Strong | Short, frequent speaking drills; low-stakes prompts |
| P18 | **Self-observation feedback improves performance** — reviewing your own recorded performance | Video/audio self-modelling and self-review in skills training | Moderate | Mandatory listen-back before rating |
| P19 | **Self-perception of speech is inaccurate** — speakers misjudge their own fillers, pace, and clarity | Self-assessment accuracy research; illusion of transparency (Gilovich et al.) | Moderate | Self-rate *before* metrics are revealed; calibration gap tracked |
| P20 | **Peer assessment improves learning** for both reviewer and reviewed | Peer-assessment meta-analysis (Double, McGrane & Hopfenbeck 2020) | Solid | Future: peer speaking review, speaking circles |
| P21 | **Commitment to another person raises follow-through** | Accountability / social commitment research | Moderate | Future: accountability partner sees trends and weekly outcomes |
| P22 | **Goal-setting theory** — specific, challenging goals outperform "do your best" | Locke & Latham (decades of studies) | Strong | Measurable targets, deadlines, weekly commitments |
| P23 | **Learning vs performance goals** — for new, complex skills, learning goals beat outcome goals | Seijts & Latham | Solid | Three goal types: outcome, learning, process |
| P24 | **Mental contrasting + implementation intentions (WOOP)** | Oettingen; Oettingen & Gollwitzer | Solid | WOOP activation gate on goals |
| P25 | **Goal-gradient effect** — effort rises as a goal's finish nears | Hull; Kivetz, Urminsky & Zheng | Solid | Milestones, journey map, missions with visible finish |
| P26 | **Ostrich effect** — people avoid monitoring when progress is bad | Webb, Chang & Benn | Solid | Guide brings goal status to you, with a fix attached |
| P27 | **Pre-commitment** — self-imposed commitments improve follow-through | Ariely & Wertenbroch | Solid | Commit & freeze; Commit week |
| P28 | **Psychological reactance** — controlling language and pressure provoke resistance | Brehm; SDT autonomy-support research | Strong | Choice in every prompt; autonomy-supportive wording; prompt budget |
| P29 | **Just-in-time adaptive prompting; habituation to repeated alerts** | Nahum-Shani et al. (JITAI); alert-fatigue literature | Moderate–solid | Prompts tied to commitments; adaptive throttling |
| P30 | **Flow** — absorption peaks when challenge matches skill, with clear goals and immediate feedback | Csikszentmihalyi | Solid | Adaptive ladders, block goals, instant reveals |
| P31 | **Curiosity / information gap** — unrevealed information pulls attention | Loewenstein | Moderate | Reveals, Week Wrapped, insight cards |
| P32 | **Scheduling work into specific time slots raises follow-through** | Implementation-intention research (indirect); time-blocking practice (Newport) | Moderate (indirect) | Calendar blocks as if-then plans |
| P33 | **Many concurrent goals compete for effort** | Goal-systems / multiple-goal pursuit research | Moderate | Max 5 active goals |
| P34 | **Generation effect** — what you produce yourself is learned and remembered far better than what you are given | Slamecka & Graf; many replications | Strong | You plan, place, decide and reflect; the app never generates these for you |
| P35 | **Cognitive offloading / automation complacency** — handing thinking to a tool weakens the underlying skill | Risko & Gilbert; automation-bias research | Solid | No AI planning/reflection; suggestions hidden until you've decided |
| P36 | **Scaffolding & fading; expertise-reversal effect** — guidance helps novices but hinders people who are already competent | Wood, Bruner & Ross; Kalyuga et al. | Solid | Guide intensity tied to skill band (§10.13) |

**Explicitly excluded:** Zeigarnik effect (inconsistent replication); ego depletion / decision fatigue (failed large-scale replication); points/badges/XP (overjustification).

---

## 4. Reference Apps — What We Take, What We Reject

| App | Take | Reject |
|---|---|---|
| **Sunsama** | Morning planning ritual; evening shutdown; over-planning warning | Price; integration sprawl |
| **Things 3** | Calm visuals; Today / Evening / Someday split; instant capture | No time awareness; no review; no skill feedback |
| **Motion** | Awareness of free time vs planned work | Auto-rescheduling — removes control and trust |
| **Linear** | Command palette; keyboard everything; speed; cycles | Team overhead |
| **Forest / Session** | Focus session as a bounded ritual | Gamified trees/coins; fixed session length that never adapts |
| **Orai / Yoodli** (speech coaches) | Automatic filler, pace and pause metrics from recordings | Score-first UI that tells you before you judge yourself; generic prompts unrelated to your work |
| **Duolingo** | Always one obvious "next" button; adaptive difficulty; delightful micro-animations; short sessions | Guilt-trip notifications; streak anxiety; leagues |
| **Fabulous** | Coach-guided journeys and step-by-step routines | Long onboarding; heavy upselling |
| **Finch** | Warm companion tone; reflection prompts | Pet-care dependency as motivation |
| **Akiflow / Structured** | Drag tasks into time blocks; day timeline | No record of what was originally committed |
| **Reclaim / Motion** | Free-slot detection | Auto-placing and auto-moving blocks |
| **Strava** | Personal records; "your year" recap stories | Public comparison, segment leaderboards |
| **Toastmasters** (method, not app) | Impromptu "Table Topics", timed speeches, filler counting, structured peer evaluation | Requires a scheduled in-person group |

**Gap none of them fill:** none treat focus, estimation, starting, commitment-keeping and speaking as skills measured and trained together on your own real work — and none combine that with an active guide that walks you into the work. That is the core of this app.

---

## 5. Skill Engine

The Skill Engine turns raw session, block and recording data into eight trainable skills. Each skill has: a **metric** (how it's measured), a **trainer** (what improves it), **feedback** (what you see), and **bands** (where you are).

### 5.1 The eight skills

| # | Skill | Question it answers | Metric (rolling 4 weeks) | Trained by | Feedback shown |
|---|---|---|---|---|---|
| S1 | **Focus Capacity** | How long can I work without breaking? | Longest session length with ≥ 80% clean completion | Focus Ladder timer | Current rung, rung history, clean-completion % |
| S2 | **Attention Control** | How often am I pulled away, and by what? | Interruptions per focused hour; % internal vs external | Distraction ledger + parking | Rate trend; heatmap by hour × project; top triggers |
| S3 | **Estimation** | How accurate are my time predictions? | Median absolute % error; bias direction (under/over) | Blind Estimate timer | Error trend; bias per project / energy type |
| S4 | **Starting** | How quickly do I start what I planned? | Start latency (plan → first session); deferrals per task | Starter timer; first-action gate; if-then cues | Latency trend; most-avoided task types |
| S5 | **Planning** | Do my days go as planned? | Today completion rate distance from 60–85% band; planned vs actual minutes | Morning plan + day-fit meter | Completion band chart; over/under-plan days |
| S6 | **Delivery** | Do my sessions and weeks produce what I intended? | % session goals met (yes = 1, partial = 0.5), combined with % weekly outcomes met | Session protocol; weekly outcome scoring; definition of done | Goal-hit trend; outcome-hit trend; per project |
| S7 | **Speaking** | Do I speak clearly, concisely and confidently? | Filler words / min; time-on-target %; self-rubric average; self-vs-measured calibration gap | Speaking Studio drills ([§7](#7-speaking-studio)) | Sub-metric trends; top personal fillers; then-vs-now playback |
| S8 | **Reliability** | Do I do what I committed to, when I said I would? | Weighted kept-rate of committed blocks (Released excluded) | Block Launcher; Commitment Ladder; week planning ([§9](#9-goals-calendar--commitments)) | Kept-rate trend; promise vs reality; kept-rate heatmap |

### 5.2 Bands (not levels, not XP)

Each skill sits in one of three bands, computed from the metric only:

| Skill | Developing | Competent | Strong |
|---|---|---|---|
| S1 Focus Capacity | < 25 min | 25–50 min | > 50 min |
| S2 Attention Control | > 4 interruptions / hr | 2–4 / hr | < 2 / hr |
| S3 Estimation | > 50% median error | 25–50% | < 25% |
| S4 Starting | > 2 days median latency | 0.5–2 days | < 0.5 day |
| S5 Planning | < 50% of days in 60–85% band | 50–75% | > 75% |
| S6 Delivery | < 50% goal hit | 50–75% | > 75% |
| S7 Speaking | Weakest of: > 6 fillers/min · < 50% on-target · rubric < 3 | Weakest of: 3–6 · 50–80% · 3–4 | All of: < 3 fillers/min · > 80% on-target · rubric > 4 |
| S8 Reliability | < 60% kept | 60–80% | > 80% |

Thresholds are **initial guesses**; after 8 weeks they are re-anchored to your own baseline (the comparison that matters is you vs your past self).

A band only changes after the metric holds for **2 consecutive weeks** — no flickering, no single-day drops.

### 5.3 The weekly drill (deliberate practice loop)

1. In weekly review, the app proposes **one** drill skill — the one with the weakest trend (or you pick).
2. For that week, the app biases suggestions toward that skill's trainer:
   - Focus → Ladder mode suggested on all deep tasks
   - Attention → ledger prompt more visible; end-of-session "what pulled you?" question
   - Estimation → Blind Estimate on every task with an estimate
   - Starting → Starter drill offered on every task deferred ≥ 1 time
   - Planning → day-fit warning threshold tightened to 100%
   - Delivery → session goal mandatory (not skippable); definition of done required on Today tasks
   - Speaking → one Speaking Studio drill suggested daily (≈ 5 min), rotating drill types
   - Reliability → Block Launcher setup checklist on by default; escalation ladder active on every block
3. The drill is presented as the week's **Mission** (§10.11). Daily: a single line at the top of Home — *"Drill this week: Estimation. 4 / 10 blind estimates done."*
4. Next weekly review opens with the drill result: metric before vs after.

### 5.4 Insight cards

Rule-based, factual pattern cards (not motivational quotes), shown in weekly review and on the Skills screen. Examples:
- "You underestimate **Writing** by 1.7×, but **Code** by only 1.1×."
- "Interruptions double after 3 pm. 70% are internal."
- "Tasks without an if-then cue take 3× longer to start."
- "Your clean-completion rate drops sharply above 50 min."
- "Your top filler is *basically* (38%). Filler rate halves on your second take."
- "On low-energy mornings (≤ 2), your focus sessions end early twice as often."

Each card links to an action ("Move deep work before 3 pm?" / "Add if-then to 3 avoided tasks?"). All cards are computed and worded by rules in code.

---

## 6. Timer System

One timer engine, five modes. Every mode is wrapped in the same **session protocol**.

### 6.1 Session protocol (wraps every timer)

```
 BEFORE (≈10s)            DURING                      AFTER (≈20s)
┌───────────────┐   ┌────────────────────────┐   ┌──────────────────────┐
│ Session goal: │   │ Timer running          │   │ Goal met?            │
│ "By the end I │ → │ D = log distraction    │ → │ [Yes][Partial][No]   │
│ will have …"  │   │ Q = park a thought     │   │ Focus quality 1–5    │
│ (+ estimate   │   │ P = pause (re-entry)   │   │ Next time, start by… │
│  if Blind)    │   │                        │   │ → Break suggested    │
└───────────────┘   └────────────────────────┘   └──────────────────────┘
```

| Step | Field | Feeds skill | Skippable? |
|---|---|---|---|
| Before | Session goal (specific outcome, one line) | S6 Delivery | Yes, except during Delivery drill week |
| Before | Prediction (minutes) | S3 Estimation | Only in Blind mode |
| During | `D` — distraction: Internal (urge/thought) or External (person/notification), optional 3-word note. Timer keeps running | S2 Attention | — |
| During | `Q` — parks a stray thought into Inbox without leaving focus | S2 Attention | — |
| After | Goal met: Yes / Partial / No | S6 Delivery | No (one click) |
| After | Focus quality 1–5 | S1, S2 (self-report cross-check) | Yes |
| After | Re-entry note | S4 Starting (next time) | Yes |

Design rule: the protocol must cost **under 30 seconds total**. If it gets skipped often, it is too heavy and will be cut down.

### 6.2 The five timer modes

#### Mode 1 — Focus Ladder *(default for `deep` tasks)* · trains S1
- **Length** = your current rung. Rungs: 15 · 20 · 25 · 30 · 35 · 40 · 45 · 50 · 60 · 75 · 90 min.
- **Clean session** = completed to the end with ≤ 1 logged distraction.
- **Climb:** 3 clean sessions at a rung → next rung unlocked and suggested.
- **Step down:** 2 consecutive abandoned sessions → suggest one rung lower (never more than one, never automatic — you confirm).
- **Ceiling:** 90 min. Beyond that, the app recommends a break rather than longer sessions.
- **Display:** ring that fills; rung shown subtly ("Rung 35"); remaining time visible.
- **Why:** P6 (edge of ability), P16 (gradual extension, measured), P13 (gentle step-down avoids collapse).

#### Mode 2 — Blind Estimate · trains S3
- Before start: enter prediction.
- **Elapsed time is hidden** — screen shows only "Running" and a slow pulse. (Seeing the clock lets you steer toward your estimate and ruins the measurement.)
- On finish: reveal card — *Predicted 30m · Actual 47m · +57% · You tend to under-estimate Writing.*
- Running error curve updates immediately.
- **Why:** P3 — calibration requires honest, immediate outcome feedback.

#### Mode 3 — Starter · trains S4
- Offered automatically for tasks deferred ≥ 2 times, aged ≥ 7 days, or tagged "avoiding".
- Commitment: **5 minutes only.** Session goal pre-filled with the task's first action.
- At 5 min: soft chime, two equal buttons — *Keep going* / *Stop here (counts as a win)*.
- Stopping is logged as a successful start, not a failure.
- Records start latency for the task.
- **Why:** P14 — tiny commitment beats the start barrier; momentum often carries past 5 min.

#### Mode 4 — Timebox · trains S5 and scoping
- For open-ended or perfectionism-prone work (email, polishing, research).
- You set a hard budget; at the end, the screen shifts to "Wrap up — 2 min" and then stops.
- Overrun (if you choose to continue) is logged; the overrun count per task type appears in insights.
- **Why:** bounding open tasks protects the day plan (P2) and makes scope a deliberate decision.

#### Mode 5 — Recovery Break · sustains S1
- Suggested after every session: break length ≈ session ÷ 5 (50 → 10 min; 25 → 5 min).
- Suggests a non-screen action (walk, water, stretch, look far away). Rotates.
- Skip allowed; skips are logged. Insight card appears if clean-completion drops after skipped breaks.
- **Why:** sustained capacity needs recovery; the data shows you whether that's true for you.

### 6.3 Mode selection

| Task signal | Suggested mode |
|---|---|
| Energy `deep` | Focus Ladder |
| Has estimate + Estimation drill week (or 1 in 3 tasks otherwise) | Blind Estimate |
| Deferred ≥ 2 / aged ≥ 7 days | Starter |
| Energy `admin` / `shallow` | Timebox |
| After any session | Recovery Break |

The suggestion is shown on the Start button ("Start · Ladder 35m"); a dropdown changes it. Never forced.

### 6.4 Timer behavior details

- Runs in a Web Worker + persisted start timestamp → survives tab switch, refresh and phone sleep.
- Browser tab title shows remaining time (or "● Running" in Blind mode).
- End-of-session sound: one soft tone, configurable / mutable.
- Only one session can run at a time.
- If the app is closed mid-session, on reopen: "Session still running (32m). Finish / Discard / Continue."

---

## 7. Speaking Studio

### 7.1 Purpose
Trains spoken communication (skill **S7**) with the loop good speakers use: **speak → hear yourself → judge → measure → retake**. Practice material comes from your own life: work explanations, interview answers, concepts you are learning, opinions you hold.

### 7.2 The practice loop

```
PICK DRILL → PREPARE (timed, optional) → RECORD → LISTEN BACK → SELF-RATE → REVEAL METRICS → ONE FIX → RETAKE (optional)
```

| Step | What happens | Rule | Why |
|---|---|---|---|
| Pick | Choose a drill type + prompt (or app suggests) | Prompt shown only after you press Start for Impromptu | Real-world surprise (P17) |
| Prepare | Short prep countdown | 0–60s by drill type | Mirrors real conditions |
| Record | Waveform + elapsed time vs target length | Soft cue at target time; hard stop at 2× target | Time discipline |
| Listen back | Full playback (1×, 1.25×, 1.5×) | **Cannot rate before listening once** | Self-observation (P18) |
| Self-rate | Rubric 1–5 + guess your filler count | Before metrics are revealed | Calibrates self-perception (P19) |
| Reveal | Auto metrics + transcript with fillers highlighted | Self-guess vs measured shown side by side | Honest outcome feedback (P3) |
| One fix | Write a single thing to change next take | Exactly one | Deliberate practice — one target at a time (P6) |
| Retake | Same prompt, new take; takes compared | Optional, max 5 takes per prompt | Immediate repetition with feedback |

### 7.3 Drill types

| Drill | Format | Prep | Length | Trains |
|---|---|---|---|---|
| **Impromptu** | Random prompt revealed at start (Toastmasters "Table Topics" style) | 10s | 60–90s | Thinking on your feet, fluency |
| **Structured Answer** | Answer using a chosen framework — PREP (Point–Reason–Example–Point) or STAR (Situation–Task–Action–Result) | 30s | 90–120s | Structure; interview answers |
| **Explain-It** | Explain a concept you are learning, as to a smart beginner (Feynman technique) | 30s | 60s | Clarity; also consolidates learning (e.g. GMAT concepts) |
| **Summarize** | Read/paste a text or note, then summarize it aloud | Reading time | 60s | Conciseness, picking the key point |
| **Rehearsal** | A prepared talk/pitch/update for a real event; multiple takes compared | Unlimited | User-set | Delivery for real situations |

**Prompt bank:** built-in categories (interview, opinion, explain, story, work update, persuasion). You can add your own prompts and link prompts to projects (e.g. *Career → interview questions*, *GMAT → concepts to explain*). Prompts are not repeated within 14 days unless retaken deliberately.

### 7.4 Automatic metrics

| Metric | How it's computed | Initial healthy range | What it shows |
|---|---|---|---|
| **Pace (WPM)** | Words ÷ speaking minutes (pauses excluded) | 130–170 | Rushing or dragging |
| **Filler rate** | Fillers per minute from a transcript that keeps disfluencies. Default list: *um, uh, like, basically, actually, you know, sort of, kind of, I mean, right, so* (editable) | < 3 / min | Verbal clutter |
| **Long pauses** | Silences > 3s mid-speech, from audio energy (computed locally) | ≤ 1 per minute | Lost thread vs deliberate pause |
| **Hedging** | *I think, maybe, probably, just, I guess* per minute | Trend only | Confidence of language |
| **Restarts & repeats** | False starts and repeated words from transcript | Trend only | Fluency |
| **Time-on-target** | Actual length vs target ± 15% | Within range | Time discipline |
| **Vocabulary variety** | Moving-average type-token ratio | Trend only | Range of expression |
| **Pitch & volume variation** *(later phase)* | Pitch/loudness spread from audio | Trend only | Monotone delivery |

Healthy ranges are starting points; like skill bands, they re-anchor to your own baseline after 8 weeks.

### 7.5 Self-rating rubric

Rated 1–5 after listening back, before metrics are shown:

| Dimension | 1 | 5 |
|---|---|---|
| **Clarity** | Listener would be confused | Instantly understandable |
| **Structure** | Wandering | Clear beginning, point, end |
| **Confidence** | Hesitant, apologetic | Steady, assured |
| **Conciseness** | Padded, repetitive | Nothing to cut |
| **Engagement** | Flat | Would hold attention |

Plus: **"How many fillers do you think you used?"** — compared against the measured count. The **calibration gap** (your guess vs reality) is tracked; shrinking it means you are learning to hear yourself in real time.

### 7.6 Progress views

- **Take comparison:** take 1 vs latest take, side-by-side waveforms, metrics diff, both playable.
- **Then vs Now:** your first recording of a drill type vs your most recent, played back to back. Strongest motivator in the module (P8).
- **Personal filler profile:** your top 3 fillers and when they spike (start of answer, transitions, under time pressure).
- **Trends:** each metric over weeks, one line each, neutral colours.
- **Milestone recordings:** first recording, band upgrades and user-pinned takes are kept permanently, even if retention cleanup is on.

### 7.7 Recording, transcription and storage

| Concern | Design |
|---|---|
| **Capture** | Browser `MediaRecorder`, Opus in WebM (≈ 32 kbps ≈ 240 KB per minute). Mic permission requested only on first recording |
| **Offline** | Recording works offline; audio held in IndexedDB and uploaded when back online |
| **Storage** | Private object storage bucket; path `recordings/{user_id}/{recording_id}.webm`; access only via short-lived signed URLs; access rules tied to owner |
| **Transcript** | Stored in DB as text + word-level timestamps (JSON), so fillers can be highlighted and clicked to jump in audio |
| **Transcription provider** | **Must preserve disfluencies.** Many speech-to-text engines remove "um/uh" by default, which would make filler metrics useless. Use a provider/mode that returns fillers and word timestamps; wrap it behind an adapter so it can be swapped. Verify current options and pricing before build |
| **Pause detection** | Computed locally from audio energy — independent of provider |
| **Consent** | First use shows: "Audio is sent to [provider] for transcription. Audio is stored privately in your account." Explicit opt-in |
| **Retention** | Default: keep everything. Option: auto-delete audio after N days but keep transcript + metrics; milestone recordings always kept |
| **Deletion** | Delete any recording (audio + transcript + metrics). Account deletion removes all audio |

### 7.8 How it connects to the rest of the app

- A Speaking drill can be planned as a Today task (`!speak`), and counts toward a project's attention budget if linked.
- Weekly drill can be **Speaking** (see §5.3).
- Speaking metrics appear as skill S7 on the Skills screen and in weekly review.
- Energy check-in data is correlated with speaking metrics in insight cards.

---

## 8. Accounts, Multi-User & Social-Ready Architecture

### 8.1 Authentication — username + password

| Item | Design |
|---|---|
| **Sign up** | Username, password, email (email used **only** for password recovery, never for login or marketing) |
| **Log in** | Username + password. Server resolves username → account, then performs password sign-in |
| **Username rules** | Unique, 3–20 chars, lowercase letters, digits, underscore; case-insensitive uniqueness; reserved names blocked (admin, root, support…) |
| **Password rules** | Minimum 10 characters; no forced complexity rules; check against known-breached passwords where the auth provider supports it (current NIST guidance favours length over complexity) |
| **Sessions** | HTTP-only secure cookies; refresh tokens; "log out of all devices" |
| **Brute-force protection** | Rate-limit login per username and per IP; generic error ("Username or password is incorrect") so usernames can't be probed |
| **Recovery** | Reset link to recovery email |
| **Switch user** | Log out → log in as another user. (Remembered-accounts switcher is a later convenience) |
| **Later options** | Optional 2FA (TOTP); optional sign-in with Google |

### 8.2 Per-user data isolation

- Every user-owned table has an `owner_id` column referencing the user.
- Row-level security on every table: a user can read/write only rows where `owner_id` = their own id.
- Storage access rules use the same rule via the `{user_id}/` path prefix.
- Everything that defines "you" is per-user: settings, timezone, day boundary, WIP caps, ladder state, skill baselines, filler list, prompt bank additions.
- No admin UI that reads users' content. Operational access is limited to aggregate health data.

### 8.3 Social-ready architecture (build conventions now, features later)

Pair and group learning are **not built in v1**, but v1 is shaped so they can be added without breaking migrations.

**Conventions applied from day one:**
1. Every shareable record (recording, skill snapshot, weekly review, outcome, focus session) has `owner_id` and a `visibility` field (`private` default).
2. All access checks go through one database function, `can_read(resource_type, resource_id)`. In v1 it only checks ownership; later it also checks shares and group membership — **one function changes, not every policy**.
3. IDs are UUIDs (safe to expose in shared links).
4. Content and aggregates are separated: a partner can be given access to **trends** without access to **task contents**.

**Future tables (designed, not created in v1):**

```
groups          id, name, kind (pair|group), created_by, created_at
group_members   group_id, user_id, role (owner|member), joined_at
shares          id, resource_type, resource_id, owner_id,
                shared_with_user_id? | shared_with_group_id?,
                permission (view|comment), created_at, expires_at?
feedback        id, resource_type, resource_id, author_id,
                rubric (json)?, comment, audio_timestamp_ms?, created_at
co_sessions     id, group_id, started_at, planned_minutes
```

### 8.4 Future pair & group features (Phase 7)

| Feature | Pair / Group | What it does | Psychology |
|---|---|---|---|
| **Accountability partner** | Pair | Partner sees your skill trends and weekly outcomes (not task contents). Weekly check-in prompt for both | P21 |
| **Co-focus session** | Pair / Group | Start a Focus Ladder session together; see partner's presence and timer only (no screen, no chat during) | Social presence ("body doubling" — anecdotal; measured per user) |
| **Peer speaking review** | Pair / Group | Share a recording; reviewer listens, rates with the same rubric, leaves timestamped comments. You see self vs peer vs measured | P20, P19 |
| **Speaking circle** | Group | Same prompt for all members each week; everyone records; each reviews two others (rotation) | P17, P20 |
| **Group goals** | Group | Cooperative target (e.g. "40 clean sessions together this week") — **no leaderboards** | Cooperation without comparison |

**Social privacy rules:** sharing is always explicit and per item (or per aggregate); nothing becomes visible by joining a group; shares can be revoked; leaving a group revokes all its shares.

---

## 9. Goals, Calendar & Commitments

This layer answers three questions the rest of the app could not:
1. **What am I working toward?** → Goals (multiple, typed, measurable)
2. **When exactly will I do it?** → Calendar with time blocks
3. **Did I do what I said I would?** → Commitment Ledger (committed vs actual, kept vs missed)

### 9.1 Analysis — why this layer matters

| Productivity problem | Psychological cause | Design response |
|---|---|---|
| Goals stay wishes | Vague goals give no standard to act against (P22) | Every goal has a measurable target, deadline and weekly time commitment |
| Goals feel motivating but don't move | Positive fantasy without obstacles lowers effort (P24) | WOOP gate: wish → outcome → obstacle → if-then plan before activation |
| Learning goals judged like exam scores | Outcome goals on new complex skills hurt performance (P23) | Three goal types: outcome, learning, process |
| "I'll do GMAT this week" never happens | No *when/where* → no cue (P1, P32) | Time blocks act as scheduled if-then plans |
| Plans silently rewritten | Memory is kind to past plans; no record of original intent | Commitments are frozen on commit; changes become revisions |
| People avoid checking progress when it's bad | Ostrich effect (P26) | The app brings goal status to you (status pulses), not the other way round |
| Over-committing every week | Planning fallacy (P2) + optimism about future self | Commitment calibration — suggests commitments you actually keep, then raises them |
| Too many goals, none progressing | Goal conflict; attention split (P33) | Max 5 active goals |
| Motivation sags mid-goal | Goal gradient — effort rises near a visible finish (P25) | Milestones, so a finish line is always near |
| One miss → whole plan abandoned | What-the-hell effect (P13) | "Released" (cancelled in advance) is not a failure; replanning is one drag |

### 9.2 Goals

**Hierarchy**

```
GOAL  (max 5 active)          e.g. "GMAT 705+ by Dec 2026"
  └── MILESTONES              e.g. "CR accuracy 80%", "Full mock ≥ 680"
        └── PROJECTS          e.g. GMAT
              └── TASKS       e.g. "Open RC set 4"
                    └── SESSIONS / BLOCKS   (time counts upward automatically)
```

**Goal types**

| Type | Use when | Target form | Example |
|---|---|---|---|
| **Outcome** | Result is measurable and mostly in your control | Number + unit or yes/no, by a deadline | GMAT 705+ by 2026-12-15 · Publish 7 posts by Jan |
| **Learning** | Skill is new/complex; result score would distort effort (P23) | Milestones of mastery or proxy metric | Master CR assumption questions (accuracy ≥ 80% over 40 questions) |
| **Process** | The behaviour itself is the goal | Hours or sessions per week | Writing 4 h/week · 4 speaking drills/week |

**Goal fields**

| Field | Purpose | Required |
|---|---|---|
| Title | Name | ✓ |
| Type | Outcome / Learning / Process | ✓ |
| Target | Measurable definition of done | ✓ |
| Deadline | Outcome/Learning goals | ✓ (not for Process) |
| Weekly time commitment | Hours/week you promise this goal | ✓ |
| Why it matters | One line; shown when status is behind (motivation reminder) | ✓ |
| WOOP | Biggest obstacle + if-then response | ✓ to activate |
| Milestones | 2–6 checkpoints with dates | Recommended |
| Linked projects | Where the work lives | ✓ |
| Weekly confidence | 0–100% chance you'll hit it (asked in weekly review) | Auto-prompted |

**WOOP activation gate (P24)** — a goal can be drafted freely, but activating it walks through:
1. **Wish:** "What do you want?" (title)
2. **Outcome:** "What's the best result, and how will it feel?" (why)
3. **Obstacle:** "What inside you is most likely to stop you?" (e.g. "I avoid RC when tired")
4. **Plan:** "If [obstacle], then I will…" (e.g. "If I'm tired at 7 am, then I do 1 Starter passage only")
The if-then becomes a cue card when the obstacle's context recurs (e.g. low energy check-in).

**Pace engine**

| Measure | Formula |
|---|---|
| Time spent | Σ focus minutes on tasks linked to the goal |
| Time debt | Σ weekly commitment since start − time spent |
| Required rate | Remaining target ÷ weeks left |
| Actual rate | 4-week moving average of progress |
| Forecast finish | Today + remaining ÷ actual rate |
| Status | **Ahead** (forecast ≥ 7 days early) · **On pace** (± 7 days) · **Behind** (7–21 days late) · **At risk** (> 21 days late or time debt > 2 weeks of commitment) |

Status colours: neutral / soft green / amber / amber with outline. **No red** (see §12.1).

**Weekly confidence forecast (novel):** in each weekly review you give each goal a 0–100% chance of being met on time. When the goal resolves, the app scores your forecasts (Brier score). Over time this trains **realistic optimism** — the same calibration logic as Blind Estimate (P3), applied to goals.

### 9.3 Calendar

**Views:** Day (default on phone) · Week (default on desktop) · Month (milestones and deadlines only).

**Block types**

| Block | What it is | Counts as commitment? | Started via |
|---|---|---|---|
| **Focus** | Task or goal work | ✓ | Block Launcher → timer (suggested mode) |
| **Speaking** | Speaking Studio drill | ✓ | Block Launcher → Studio |
| **Ritual** | Morning plan, shutdown, weekly review | ✓ (light) | Guided ritual |
| **Buffer** | Unassigned slack | ✗ | — |
| **Recovery** | Break / exercise / walk | Optional | Break timer |
| **Fixed** | External events (meetings, synced from Google) | ✗ | — |

**Block anatomy:** title · linked task/goal · committed minutes · start time · timer mode · auto-generated if-then line (*"At 07:00, at my desk → open RC set 4"*) · optional context (place) · recurrence.

**Capacity rule:** committed blocks ≤ **60%** of free hours (waking window − fixed events). The remaining 40% is buffer for reality. Planning above 60% shows the amber capacity bar and a suggestion — never a block.

**Placement hints (on request, fading):** you place blocks yourself. Depending on your band (§10.13) the app can highlight hint slots, based on: your peak-energy hours (P15), historical kept-rate by hour/day (from the ledger), and existing commitments.

**Recurring blocks:** e.g. *GMAT RC, Mon–Fri 07:00–07:50*. Each occurrence is its own commitment in the ledger.

**Google Calendar:** read-only import of fixed events in Phase 3; two-way sync (publishing your blocks) is a later option.

### 9.4 Commitment Ledger

**What counts as a commitment**

| Level | Committed when | Frozen snapshot |
|---|---|---|
| **Block** | Week plan committed, or block added with "Commit" | Start time, committed minutes, linked goal |
| **Day** | Morning plan "Start day" | Planned tasks, planned minutes, blocks |
| **Week (per goal)** | Weekly planning "Commit week" | Hours committed per goal |
| **Goal** | Activation | Target, deadline, weekly commitment |

**Frozen means:** the original is stored and never edited. Any later change (move, shorten, cancel) creates a **revision** with a timestamp and optional reason. Reports always compare **original commitment vs reality**, while the plan itself stays fully flexible.

**Block outcomes** (assigned automatically from timer data; editable)

| Outcome | Rule (defaults) | Counts as |
|---|---|---|
| **Kept** | Started ≤ 10 min late and actual ≥ 80% of committed | 1.0 |
| **Shortened** | Actual 30–80% of committed | 0.5 |
| **Moved** | Rescheduled after commit; scored by the moved block's outcome × 0.75 | 0.75 × outcome |
| **Released** | Cancelled ≥ 2 h before start, with a reason | Excluded (not a failure) |
| **Missed** | Not started, or actual < 30% | 0 |

**Why "Released" exists:** cancelling deliberately and early is a planning skill; silently skipping is the failure mode. Separating them keeps honesty high (P13) and stops the what-the-hell spiral.

**Committed vs actual — reported at every level**

| View | Shows |
|---|---|
| Block | Committed 50m · Actual 42m · Started 4 min late · Shortened |
| Day | Committed 4h 10m · Actual 3h 20m · 4 of 5 blocks kept |
| Goal (week) | GMAT: committed 8h · actual 6h 15m · kept 5/7 · moved 1 · missed 1 · time debt +1h 45m |
| Goal (lifetime) | Committed vs actual cumulative line chart; forecast finish |
| Week / Month | Promise vs reality bars per goal; kept-rate trend; heatmap of kept-rate by hour × weekday |

### 9.5 Commitment calibration (Commitment Ladder)

Mirrors the Focus Ladder, applied to promises:

- If a goal's actual hours are < 75% of committed for **3 consecutive weeks**, the weekly planner suggests: *"You've delivered ~6h/week on GMAT. Commit to 6.5h and keep it?"*
- If kept-rate ≥ 90% for **2 consecutive weeks**, it suggests **+10%**.
- If the goal's pace requires more than you reliably deliver, it says so plainly: *"At 6.5h/week, GMAT 705 forecasts for Feb, not Dec. Raise hours, move the date, or adjust the target?"*

The point: commitments become **promises you keep**, and then grow. Chronically broken commitments train you to ignore your own plans.

### 9.6 New skill — S8 Reliability

| Skill | Question | Metric (rolling 4 weeks) | Sub-metrics | Trained by |
|---|---|---|---|---|
| **S8 Reliability** | Do I do what I said I would, when I said I would? | Weighted kept-rate of committed blocks (Released excluded) | Time fidelity (actual ÷ committed minutes); punctuality (median minutes late); release lead time; moves per week | Block Launcher, commitment calibration, start escalation, weekly planning |

Bands: **Developing** < 60% · **Competent** 60–80% · **Strong** > 80%.

S5 Planning vs S8 Reliability: Planning = *is the plan realistic?* Reliability = *do I honour the plan?* Both are needed; a perfect planner who doesn't show up and a reliable doer with fantasy plans both fail.

### 9.7 Insight examples

- "Blocks before 9 am: 86% kept. After 8 pm: 31%. Move evening GMAT blocks to mornings?"
- "You commit 10h/week to Writing and deliver 5.5h. Commit to 6h?"
- "Moved blocks are kept only 40% of the time. Releasing early may be more honest."
- "GMAT confidence forecasts: you've been 25 points over-confident on average."
- "Blocks with a setup checklist completed are kept 1.6× more often."

---

## 10. The Guide — Active, Interactive Layer

### 10.1 What changes

Most productivity apps are **passive**: they wait to be opened, and the user must decide what to do. This app is **active**: it knows your commitments, goals, energy and skills, and at every moment it **tells you the next step, walks you into it, and shows what's left** — like a coach running the day with you.

| Passive app | This app |
|---|---|
| You open it and look at a list | It opens on **one recommended next action**, with the reason |
| You remember your plan | It reminds you 5 min before a block and walks you into it |
| You decide when to start | Block start launches a "sit down" sequence with countdown |
| A missed block silently disappears | It offers: start 5 min now, move to a found slot, or release |
| You check goal progress (or avoid it) | It brings goal status to you mid-week, with a fix |
| Free 20 minutes go to scrolling | It spots the gap and offers something that fits it |
| Rituals depend on discipline | Rituals are guided conversations, step by step |
| Stats sit on a dashboard | "Week Wrapped" — a short story of your week, revealed card by card |

The Guide has four engines:
1. **Next-Best-Action engine** — decides what to recommend now (§10.4)
2. **Ritual conductor** — runs guided flows (morning, block, shutdown, week) (§10.5)
3. **Prompt scheduler** — decides when to reach out, within a strict budget (§10.7–10.8)
4. **Coach voice** — how it speaks: tone presets (§10.12)

All four are governed by **Scaffold, then fade** (§10.13): the Guide helps most where you are weakest and steps back as you improve.

### 10.2 Psychology analysis — active without being annoying

Being proactive is powerful and dangerous. The same prompt that gets you to start can, repeated, make you resent and abandon the app.

| Force | Effect | Design response |
|---|---|---|
| **Prompts trigger behaviour** (P10) | Without a prompt, motivation and ability go unused | Block starts, gap offers, Now card |
| **Just-in-time works best** (P29) | Prompts at moments of need and receptivity work; random ones don't | Prompts tied only to *your own* commitments, gaps and patterns |
| **Habituation / alert fatigue** (P29) | Repeated prompts lose effect | Daily prompt budget; types you ignore get throttled |
| **Reactance** (P28) | Controlling language and pressure cause resistance | Autonomy-supportive wording; every prompt offers choices incl. "not now" |
| **Ostrich effect** (P26) | People avoid bad news | The guide brings status proactively — gently, with a fix attached |
| **Flow** (P30) | Engagement peaks when challenge ≈ skill, with clear goals and feedback | Adaptive difficulty (ladders, prompts), clear block goals, instant reveals |
| **SDT — autonomy, competence, relatedness** (P7) | Intrinsic motivation needs all three | Choices always offered; ability-based feedback; coach warmth; pairs later |
| **Curiosity / information gap** (P31) | Unrevealed information pulls attention | Reveal mechanics: Blind Estimate, speaking reveal, Week Wrapped, insight cards |
| **Overjustification** (P7) | Points for activity crowd out intrinsic motivation | Fun comes from mastery, progress and discovery — not points |

### 10.3 Guardrails — "guide, never nag"

Every proactive prompt must pass all seven:

1. **Earned** — tied to something you committed to, a gap in your day, or a pattern in your own data. Never generic engagement bait.
2. **Actionable in one tap** — the prompt contains the action (Start / Move / Release), not just information.
3. **Offers choice** — always at least one alternative and "Not now".
4. **Budgeted** — counts against a daily prompt budget (default 6; block starts you scheduled don't count).
5. **Adaptive** — a prompt type ignored 3 times in a row is throttled, and the coach asks if you want fewer.
6. **Respects focus and rest** — nothing during a focus session (except session end), nothing in quiet hours.
7. **No guilt** — never mentions streaks lost, never uses red, never "you failed".

### 10.4 Next-Best-Action engine

Decides the single recommendation shown on the **Now card** (top of Home) and in "What should I do?" requests.

**Evaluation order (first match wins, then scored alternatives):**

| # | Situation | Recommendation |
|---|---|---|
| 1 | A committed block is active now | Start that block |
| 2 | A paused session has a re-entry note | Resume it |
| 3 | Morning plan not done (before noon) | Run morning plan |
| 4 | > 3 sessions without a break | Take a recovery break |
| 5 | Goal **at risk** and a free slot is available now, energy fits | A task for that goal |
| 6 | Weekly mission has today's step pending | Mission step (e.g. speaking drill) |
| 7 | Next Today task (in order) | That task, with suggested timer mode |
| 8 | Free gap < 30 min before next block | **Gap filler**: something that fits (speaking drill, inbox 5 min, Starter on an avoided task) |
| 9 | Inbox > 10 items | Process inbox (5 min timebox) |
| 10 | Aging queue not empty | Decide one aged task |
| 11 | Evening past day boundary − 1h | Run shutdown |

**Scoring factors for alternatives:** goal urgency (pace status), commitment (blocked > loose), energy match, fit to available time, drill/mission relevance, avoidance (Starter for deferred tasks), time of day kept-rate.

**Transparency:** every recommendation shows a **"Why this?"** line (*"GMAT is 2h behind this week and you keep 86% of morning blocks"*) and a **"Something else"** button revealing the next two options. You can always override; overrides are learned as preferences.

**Fading:** for skills in the *Competent* band, the Now card first asks **"What's next?"** and shows its own recommendation only after you answer (or tap "Show suggestion"). In the *Strong* band it only surfaces commitments you made. See §10.13.

### 10.5 Guided rituals

All rituals are **step-by-step guided flows** in the coach's voice — one question per screen, large touch targets, progress dots, skippable steps, typical duration shown upfront.

| Ritual | When | Duration | Steps |
|---|---|---|---|
| **Morning** | First open of the day | ~3 min | Energy check-in → yesterday's wins → today's blocks (calendar strip) → pick loose tasks → fit check → "Here's your day" summary → first block heads-up |
| **Block start** | Block start time | ~20 s | See §10.6 |
| **Block end** | Timer ends | ~20 s | Goal met? → quality → reveal → re-entry note → next suggestion |
| **Midday pulse** | Midday, only if something is off | ~30 s | "2 blocks kept, 1 missed. GMAT still 1h short today — slot at 4 pm free. Add?" |
| **Shutdown** | Day boundary − 1h (or on request) | ~2 min | Leftovers → tomorrow's first block → Done Wall → one reflection question → "Day closed" |
| **Week planning** | Sunday evening / Monday morning | ~10 min | Week Wrapped (last week) → goal pace → commitment suggestions → drag goal hours onto calendar → capacity check → **Commit week** |
| **Weekly review** | Inside week planning (or separately) | ~8 min | See §13.12 |

### 10.6 Block Launcher — the "sit down" sequence

The moment of starting is where most plans die. The launcher makes starting the path of least resistance.

```
T −5 min   Heads-up: "GMAT RC in 5 min. Wrap up what you're doing."   (in-app; push only if enabled)
T  0       Launch screen opens (full screen if app is open)
           ┌──────────────────────────────────────────┐
           │  07:00 · GMAT RC                  50 min │
           │  Serves: GMAT 705+ · 3.5h left this week │
           │  Last time: start with question 14       │
           │                                          │
           │  Setup  ☐ Phone in other room            │
           │         ☐ Notifications off              │
           │         ☐ Water                          │
           │         ☐ RC book open                   │
           │                                          │
           │  Goal for this block: [ 3 passages ]     │
           │                                          │
           │          [  I'm ready — start  ]         │
           │      Shorten · Move · Release            │
           └──────────────────────────────────────────┘
           → 3 · 2 · 1 countdown → timer starts (suggested mode)
```

- **Setup checklist** is per user and per block type (customisable). Ticking items is optional — but the app learns whether completed checklists correlate with kept blocks and tells you.
- **Countdown** is a deliberate micro-ritual: a clear boundary between "before" and "working".
- **Psychology:** P1 (block = if-then), P10 (prompt + ability), P11 (concrete goal), P27 (commitment honoured), P12 (re-entry note).

### 10.7 Start escalation ladder

If a block's start passes without action:

| Time | Prompt | Options |
|---|---|---|
| T 0 | Launch screen / push | Start · Shorten · Move · Release |
| T +5 min | One push: *"GMAT block started 5 min ago. Still on?"* | Start now · Start 5-min Starter · Move |
| T +15 min | Final in-app card: *"Want to rescue this one?"* | 5-min Starter · Move to a found slot (shown) · Release |
| After | Silence. Block marked **Missed** at its end if no action | — |

Maximum **two** pushes per block. Never escalates in tone.

### 10.8 Prompt budget & adaptivity

| Rule | Default |
|---|---|
| Daily proactive prompt budget (excludes scheduled block starts and cue cards you created) | 6 |
| Quiet hours | 22:00–07:00 (per user) |
| During focus session | None (except session end) |
| Ignored 3× in a row (same prompt type) | Throttle that type to half; coach asks "Fewer of these?" |
| Acted on ≥ 70% of the time | Allowed to keep its frequency |
| Channel | In-app first; push only when app is in background and the prompt is time-critical |

All prompt events (shown / acted / dismissed / ignored) are logged — the Guide learns *your* receptivity, per prompt type and time of day (P29).

### 10.9 What's Left panel

Always one click away (sidebar on desktop, pull-up sheet on phone). Answers *"where do I stand right now?"* in one glance.

```
WHAT'S LEFT · Wed
Today     ▸ 2 blocks: 16:00 Writing (50m) · 18:30 Speaking (15m)
          ▸ 3 tasks loose · day-fit 80%
This week ▸ GMAT      6h / 8h   ▓▓▓▓▓▓░░  2 blocks scheduled
          ▸ Writing   1h / 4h   ▓▓░░░░░░  ⚠ 3h unscheduled  [Find time]
          ▸ Speaking  2 / 4 drills
Rituals   ▸ Shutdown at 21:00
Mission   ▸ Blind estimates 6 / 10
Inbox     ▸ 4 to sort
```

Every row is interactive: tap to start, schedule, or open. **"Find time"** proposes slots for unscheduled goal hours.

### 10.10 Proactive replanning

| Trigger | Guide action |
|---|---|
| Block missed or released | Asks **"Where will you move it?"** and opens the calendar with free time shaded. You choose. A suggested slot appears only on "Hint" (Developing band: shown upfront) |
| Goal behind pace mid-week (Wed pulse) | "Writing is 3h short this week. Thu 16:00 and Sat 10:00 are free — add?" |
| Day overloaded (new fixed event imported) | "A 2h meeting landed on Thursday. Your GMAT block overlaps — move to 07:00?" |
| Commitment chronically over-promised | Commitment calibration suggestion (§9.5) in week planning |

Rule: **you decide** where things go; the Guide shows free time and, depending on your band, a hint. Nothing is ever moved without your action (Principles 5, 17).

### 10.11 Fun — engagement through mastery, not points

| Element | What it is | Why it's fun | Psychology |
|---|---|---|---|
| **Adaptive challenge** | Focus Ladder, Commitment Ladder, speaking prompts that get harder as you improve | Always at the edge of ability — the zone where work feels absorbing | P30 Flow |
| **Reveals** | Blind Estimate result, speaking metric reveal, week planning confidence scoring | A small moment of suspense and surprise, every session | P31 |
| **Personal records** | "Longest clean session: 55m" · "Lowest filler rate: 1.8/min" · "Best kept-week: 100%" — shown when broken | Beating your own best is intrinsically rewarding; honest and ability-based | P7, P8 |
| **Missions** | Weekly drill framed as a mission with a clear finish (e.g. *"10 blind estimates"*, *"Keep all 5 GMAT blocks"*). One main + one optional side mission. Visual stamp on completion | Clear goal + visible finish line + choice | P25, P22 |
| **Week Wrapped** | Every week opens with 5–7 swipeable story cards: your best session, a PR, kept-rate, a surprising pattern, then-vs-now clip, next week's mission | Curiosity, story, progress — a reward for doing the review | P8, P31 |
| **Journey map** | Each goal shown as a path with milestones; your marker moves with progress; forecast finish shown as a flag | Goal gradient made visible | P25 |
| **Then vs Now** | Speaking recordings, focus capacity, estimation error — first vs latest | Seeing growth is the strongest motivator | P8 |
| **Tactile UI** | Drag blocks, satisfying check animation, kept blocks "settle" with a soft glow, timer ring fills | Physical feel of progress | — |
| **Celebration scaling** | Small tick for a task; brief animation for a kept block; full-screen moment only for PRs, milestones, band upgrades | Celebrations stay meaningful because they're rare and earned | P7 |
| **Coach personality** | Choose tone: Calm · Direct · Playful | Feels like *your* coach | SDT autonomy, relatedness |
| **Gap fillers** | "18 min free — quick Impromptu drill?" | Turns dead time into small wins | P10 |

**Never used for fun:** points, coins, XP, virtual pets that "die", leagues, leaderboards, fake streak pressure, loot boxes / random rewards for activity.

### 10.12 Coach voice

Tone presets only — fixed, hand-written copy. There is no AI chat.

**Tone presets** — same event, three voices:

| Event | Calm | Direct | Playful |
|---|---|---|---|
| Block start | "Your GMAT block is ready when you are." | "GMAT, 50 minutes. Start now." | "Desk, water, RC book. Let's go get those 3 passages." |
| Missed block | "That one slipped. Want to find another slot?" | "Missed. Slot at 16:00 is free — take it?" | "The 7 am block escaped. 16:00 looks open — rematch?" |
| PR | "New personal best: 55 minutes clean." | "Record: 55 min clean." | "55 minutes, zero breaks. That's a new record." |
| Behind on goal | "Writing is a little behind this week. Here's a slot that could help." | "Writing: 3h short. Two free slots. Pick one." | "Writing's lagging. Thu 4 pm is free and suspiciously writing-shaped." |

### 10.13 Scaffold, then fade

The Guide is a set of training wheels that come off. Its intensity per area is set by the band of the related skill:

| Guide behaviour | Related skill | Developing | Competent | Strong |
|---|---|---|---|---|
| Now card | S5 Planning | Shows recommendation + why | Asks "What's next?" first; suggestion on request | Shows only your own next commitment |
| Placement while planning the week | S5 Planning, S8 | Hint slots visible while dragging | Hint on request only | No hints; capacity bar only |
| Replanning a missed block | S8 Reliability | Free time + one hinted slot | Free time only; hint on request | "Moved?" reminder only |
| Start escalation | S4 Starting, S8 | T0 + 5 min + 15 min | T0 + 15 min | T0 only |
| Timer mode suggestion | S1 / S3 / S4 | Pre-selected | Shown, not pre-selected | Not shown |
| Morning ritual | S5 Planning | Full guided flow | Short flow (skip what you do well) | One-screen check-in |
| Session goal prompt | S6 Delivery | Example goals shown | Empty field | Empty field, optional |

Rules:
- Fading happens **automatically** when a band holds for 2 weeks, and the Guide tells you: *"You plan well now — I'll ask instead of suggest."*
- If a skill drops a band, support returns quietly — no announcement, no judgement.
- You can override the level per area in settings (more help / less help).

**Self-direction rate** — the share of decisions you made yourself (picked your own next task, placed your own blocks, moved blocks to slots you chose) vs suggestions you accepted. Shown on the Skills screen under the skills, trending over time. It should **rise**; a flat or falling rate means the Guide is being leaned on and should fade faster.

---

## 11. Feature Catalogue

**Legend**
- **Tier:** `Core` = app is useless without it · `Supporting` = makes the core work better · `Optional` = can be cut · `Future` = designed, built later
- **Usefulness:** ★★★ high daily impact · ★★ weekly / meaningful · ★ marginal
- **Skill:** which skill(s) it trains (S1–S8), or — for infrastructure
- **Novel:** not standard in mainstream apps
- **Phase:** see [§16](#16-build-phases)

### 11.1 Capture & Organization

| ID | Feature | What it does | Why | Skill | Tier | Use | Novel | Phase |
|---|---|---|---|---|---|---|---|---|
| F1 | **Quick capture** | Global `Q` opens single-line input; tokens `#project ~30m !deep !speak` | P10 | — | Core | ★★★ | | 0 |
| F2 | **Inbox** | Unprocessed captures; triage one at a time | Separates capture from commitment | S5 | Core | ★★★ | | 1 |
| F3 | **Projects** | Colour, status, weekly hour budget | Grouping by life area | — | Core | ★★★ | | 0 |
| F4 | **Active project cap** | Max 5 active projects | P5 | S5 | Supporting | ★★ | ✓ | 2 |
| F5 | **Someday list** | Parking for uncommitted ideas | Reduces list guilt | — | Supporting | ★★ | | 1 |

### 11.2 Daily Loop

| ID | Feature | What it does | Why | Skill | Tier | Use | Novel | Phase |
|---|---|---|---|---|---|---|---|---|
| F6 | **Morning plan ritual** | Guided flow: check-in → yesterday → pick → fit | P2, P9 | S5 | Core | ★★★ | | 1 |
| F7 | **Today with WIP cap** | Max 7 tasks; Main + Evening | P5 | S5 | Core | ★★★ | | 1 |
| F8 | **Day-fit meter** | Planned × multiplier vs available hours | P2 | S5 | Core | ★★★ | ✓ | 1 |
| F9 | **First-action gate** | Today tasks must start with a concrete verb + object | P11 | S4 | Core | ★★★ | ✓ | 1 |
| F10 | **Timer engine + session protocol** | See [§6](#6-timer-system) | P4, P6 | S1–S6 | Core | ★★★ | ✓ | 1 |
| F11 | **Re-entry note** | "Next time, start by…" on pause/stop | P12 | S4 | Supporting | ★★★ | ✓ | 1 |
| F12 | **Evening shutdown** | Resolve leftovers → Done Wall → "Day closed" | P8 | S5 | Core | ★★★ | | 1 |
| F13 | **Done Wall** | Today's completions + focus minutes + speaking drills; read-only | P8 | — | Supporting | ★★ | ✓ | 1 |

### 11.3 Timer Modes

| ID | Feature | What it does | Skill | Tier | Use | Novel | Phase |
|---|---|---|---|---|---|---|---|
| F29 | **Focus Ladder** | Progressive session length from clean completions | S1 | Core | ★★★ | ✓ | 1 |
| F30 | **Blind Estimate** | Hidden clock; reveal error at end | S3 | Core | ★★★ | ✓ | 2 |
| F31 | **Starter** | 5-min commitment for avoided tasks | S4 | Supporting | ★★★ | ✓ | 2 |
| F32 | **Timebox** | Hard budget with wrap-up | S5 | Supporting | ★★ | | 2 |
| F33 | **Recovery Break** | Suggested break ≈ session ÷ 5 | S1 | Supporting | ★★ | | 1 |
| F34 | **Distraction ledger** | `D` logs internal/external interruption during session | S2 | Core | ★★★ | ✓ | 1 |
| F35 | **Distraction parking** | `Q` during focus parks thought to Inbox without leaving | S2 | Supporting | ★★★ | | 1 |

### 11.4 Skill Engine

| ID | Feature | What it does | Skill | Tier | Use | Novel | Phase |
|---|---|---|---|---|---|---|---|
| F36 | **Skill metrics & bands** | Computes S1–S8 with Developing / Competent / Strong bands | All | Core | ★★★ | ✓ | 2 |
| F37 | **Skills screen** | One card per skill: band, trend, current drill | All | Core | ★★★ | ✓ | 2 |
| F38 | **Weekly drill** | One skill focus per week; biases suggestions | All | Core | ★★★ | ✓ | 5 |
| F39 | **Insight cards** | Rule-based personal patterns linked to an action | All | Supporting | ★★★ | ✓ | 5 |
| F40 | **Baseline re-anchoring** | After 8 weeks, bands re-anchor to your own history | All | Supporting | ★★ | ✓ | 6 |

### 11.5 Time Honesty

| ID | Feature | What it does | Skill | Tier | Use | Novel | Phase |
|---|---|---|---|---|---|---|---|
| F14 | **Estimate vs actual** | Estimate from `~30m`, actual from sessions | S3 | Core | ★★★ | | 2 |
| F15 | **Personal multiplier** | Rolling median actual/estimate per project & energy (≥ 10 samples); applied in day-fit | S3, S5 | Supporting | ★★★ | ✓ | 2 |
| F16 | **Attention budget** | Weekly target hours per project; drift bars | S5 | Supporting | ★★★ | ✓ | 2 |

### 11.6 Speaking Studio

| ID | Feature | What it does | Why | Skill | Tier | Use | Novel | Phase |
|---|---|---|---|---|---|---|---|---|
| F41 | **Recorder** | Record with waveform, target-time cue, offline support | Foundation of the module | S7 | Core | ★★★ | | 4 |
| F42 | **Drill types & prompt bank** | Impromptu, Structured Answer, Explain-It, Summarize, Rehearsal; custom prompts linked to projects | P6, P17 | S7 | Core | ★★★ | ✓ (project-linked prompts) | 4 |
| F43 | **Listen-back gate** | Must listen once before rating | P18 | S7 | Core | ★★★ | ✓ | 4 |
| F44 | **Blind self-rating** | Rubric + filler guess before metrics reveal; calibration gap tracked | P19, P3 | S7 | Core | ★★★ | ✓ | 4 |
| F45 | **Auto speech metrics** | Pace, fillers, long pauses, hedging, restarts, time-on-target, vocabulary variety; transcript with highlights | P3 | S7 | Core | ★★★ | | 4 |
| F46 | **One fix + retake comparison** | One change per take; take 1 vs take N side by side | P6 | S7 | Supporting | ★★★ | ✓ | 4 |
| F47 | **Then vs Now** | First vs latest recording of a drill type, back to back | P8 | S7 | Supporting | ★★★ | ✓ | 4 |
| F48 | **Personal filler profile** | Your top fillers and where they spike | P19 | S7 | Supporting | ★★ | ✓ | 4 |
| F49 | **Prosody metrics** | Pitch and volume variation (monotone detection) | — | S7 | Optional | ★★ | | 6 |

### 11.7 Behavior Layer

| ID | Feature | What it does | Skill | Tier | Use | Novel | Phase |
|---|---|---|---|---|---|---|---|
| F17 | **If-then cue** | If [trigger/time] then [action]; time cues render as cue cards | S4 | Supporting | ★★★ | ✓ | 5 |
| F18 | **Habits (never miss twice)** | Consistency %, not streaks; single miss neutral | — | Supporting | ★★ | ✓ | 5 |
| F19 | **Energy tags & matching** | `deep / shallow / admin`; peak-hour suggestions | S1, S2 | Optional | ★★ | | 5 |
| F20 | **Aging decision queue** | 14-day untouched → Do / Starter / Schedule / Someday / Kill | S4 | Supporting | ★★★ | ✓ | 5 |
| F21 | **Kill list** | Dropped tasks shown as decisions made | — | Optional | ★★ | ✓ | 5 |
| F56 | **Energy check-in** | One tap (1–5) at morning plan; optional sleep hours. Correlated with focus and speaking in insight cards | P15 | S1, S2, S7 | Supporting | ★★ | ✓ | 1 |

### 11.8 Review & Delivery

| ID | Feature | What it does | Skill | Tier | Use | Novel | Phase |
|---|---|---|---|---|---|---|---|
| F22 | **Weekly review** | Combined review + planning: Week Wrapped → outcomes → goals → mission result → skills → cleanup → commitments → plan → Commit week | All | Core | ★★★ | | 5 |
| F57 | **Outcome scoring + definition of done** | Weekly 3 outcomes are graded (met / partial / missed) at next review; tasks can carry a one-line "done when…" | S6 | Core | ★★★ | ✓ | 5 |
| F23 | **Fresh-start prompt** | Monday / 1st-of-month reset card | — | Supporting | ★★ | | 6 |

### 11.9 Onboarding

| ID | Feature | What it does | Skill | Tier | Use | Novel | Phase |
|---|---|---|---|---|---|---|---|
| F55 | **Baseline week** | First 7 days are calibration: app observes without drills, sets ladder start rung, and asks for 3 baseline speaking recordings (one Impromptu, one Explain-It, one Structured Answer) when the Studio is live. Without a baseline, improvement can't be shown | All | Core | ★★★ | ✓ | 1 (speaking part: 4) |

### 11.10 Accounts, Data & Platform

| ID | Feature | What it does | Tier | Use | Phase |
|---|---|---|---|---|---|
| F51 | **Username + password auth** | Sign up / log in / log out / recovery email / rate limiting ([§8.1](#81-authentication--username--password)) | Core | ★★★ | 0 |
| F52 | **Per-user data isolation** | `owner_id` + row-level security on every table and storage path | Core | ★★★ | 0 |
| F53 | **Profile & personal settings** | Username, display name, timezone, day boundary (e.g. day ends at 3 am), caps, filler list | Core | ★★ | 0 |
| F54 | **Social-ready conventions** | `visibility` field, single `can_read()` access function, UUIDs ([§8.3](#83-social-ready-architecture-build-conventions-now-features-later)) | Core (architecture) | — | 0 |
| F58 | **Offline-first sync** | Capture, timer and recording work offline; queued writes sync when online | Supporting | ★★ | 1 (recording: 4) |
| F59 | **Data controls** | Audio retention setting, delete recording, delete account (removes everything incl. audio) | Core | ★★ | 4 |
| F28 | **Export** | JSON/CSV of all data + audio zip | Supporting | ★ | 4 |
| F25 | **Command palette** | `Ctrl+K` — every action reachable by typing | Core | ★★★ | 0 |
| F26 | **PWA install** | Phone install for capture, Today, timer, recording | Supporting | ★★ | 0 |

### 11.11 Pair & Group Learning (Future)

| ID | Feature | What it does | Skill | Tier | Phase |
|---|---|---|---|---|---|
| F61 | **Accountability partner** | Partner sees trends + weekly outcomes, not task contents | S4, S6 | Future | 7 |
| F62 | **Co-focus session** | Synchronised focus sessions with presence only | S1, S2 | Future | 7 |
| F63 | **Peer speaking review** | Share a recording; peer rates with same rubric + timestamped comments | S7 | Future | 7 |
| F64 | **Speaking circle** | Weekly shared prompt; rotating peer reviews | S7 | Future | 7 |
| F65 | **Group goals** | Cooperative targets, no leaderboards | — | Future | 7 |

### 11.12 Goals

| ID | Feature | What it does | Why | Skill | Tier | Use | Novel | Phase |
|---|---|---|---|---|---|---|---|---|
| F66 | **Multiple typed goals** | Outcome / Learning / Process goals with target, deadline, weekly time commitment | P22, P23 | S6, S8 | Core | ★★★ | | 3 |
| F67 | **WOOP activation gate** | Wish → Outcome → Obstacle → If-then plan before a goal goes active | P24 | S4 | Core | ★★★ | ✓ | 3 |
| F68 | **Goal hierarchy & auto-attribution** | Goal → milestones → projects → tasks; session time counts toward goals automatically | Removes manual logging | S6 | Core | ★★★ | | 3 |
| F69 | **Pace engine** | Time debt, required vs actual rate, forecast finish, status (ahead / on pace / behind / at risk) | P26 | S5, S6 | Core | ★★★ | ✓ | 3 |
| F70 | **Milestones & journey map** | 2–6 checkpoints; goal shown as a path with your marker and forecast flag | P25 | — | Supporting | ★★ | ✓ | 3 |
| F71 | **Active goal cap** | Max 5 active goals | P33 | S5 | Supporting | ★★ | | 3 |
| F72 | **Weekly confidence forecast** | 0–100% chance per goal each week; scored when goal resolves (Brier) | P3 | S3 | Supporting | ★★ | ✓ | 5 |

### 11.13 Calendar

| ID | Feature | What it does | Why | Skill | Tier | Use | Novel | Phase |
|---|---|---|---|---|---|---|---|---|
| F73 | **Calendar views** | Day / Week / Month; drag-and-drop | Time made visible | S5 | Core | ★★★ | | 3 |
| F74 | **Typed time blocks** | Focus / Speaking / Ritual / Buffer / Recovery / Fixed; each with committed minutes, timer mode and auto if-then line | P1, P32 | S5, S8 | Core | ★★★ | ✓ (if-then line) | 3 |
| F75 | **Week planning ritual** | Drag each goal's weekly hours onto the week; capacity check; **Commit week** | P22, P27 | S5, S8 | Core | ★★★ | | 3 |
| F76 | **Capacity rule** | Committed blocks ≤ 60% of free hours; amber bar above that | P2 | S5 | Core | ★★★ | ✓ | 3 |
| F77 | **Recurring blocks** | Weekly patterns (e.g. GMAT weekdays 07:00) | Fewer decisions | S8 | Supporting | ★★★ | | 3 |
| F78 | **Placement hints** | Hint slots by energy, kept-rate history, capacity — shown per band, on request once Competent | P15 | S8 | Supporting | ★★ | ✓ | 3 |
| F27 | **Google Calendar sync** | Read-only import of fixed events (Phase 3); two-way publish of blocks later (Phase 8) | Real availability | S5 | Supporting | ★★ | | 3 / 8 |

### 11.14 Commitment Ledger

| ID | Feature | What it does | Why | Skill | Tier | Use | Novel | Phase |
|---|---|---|---|---|---|---|---|---|
| F79 | **Commit & freeze** | Block, day, week and goal commitments stored as original snapshots; changes become revisions | P27 | S8 | Core | ★★★ | ✓ | 3 |
| F80 | **Block outcomes** | Kept / Shortened / Moved / Released / Missed, auto-assigned from timer data | P13 | S8 | Core | ★★★ | ✓ | 3 |
| F81 | **Committed vs actual reports** | Per block, day, goal-week, goal-lifetime, week, month; kept-rate heatmap by hour × weekday | P4 | S8 | Core | ★★★ | ✓ | 3 |
| F82 | **Commitment Ladder** | Right-sizes over-promised commitments, then raises them after 2 kept weeks | P2, P6 | S8 | Supporting | ★★★ | ✓ | 5 |
| F83 | **Reliability skill (S8)** | Weighted kept-rate + time fidelity + punctuality, with bands | P4, P7 | S8 | Core | ★★★ | ✓ | 3 |

### 11.15 The Guide (active layer)

| ID | Feature | What it does | Why | Skill | Tier | Use | Novel | Phase |
|---|---|---|---|---|---|---|---|---|
| F84 | **Now card (Next-Best-Action)** | Next step at all times; recommends (Developing), asks first (Competent), shows only your commitments (Strong) | P10, P29 | All | Core | ★★★ | ✓ | 1 |
| F85 | **What's Left panel** | Today's blocks/tasks, weekly goal hours, rituals, mission, inbox — all actionable | P26 | S5, S8 | Core | ★★★ | ✓ | 1 (goals part: 3) |
| F86 | **Guided rituals** | Morning, block end, midday pulse, shutdown, week planning — step-by-step in coach voice | P9, P10 | All | Core | ★★★ | | 1 |
| F87 | **Block Launcher** | Heads-up −5 min → launch screen with setup checklist and block goal → 3-2-1 countdown → timer | P1, P10, P11 | S4, S8 | Core | ★★★ | ✓ | 3 |
| F88 | **Start escalation ladder** | T0 / +5 / +15 min prompts with rescue options; max 2 pushes; then silent | P14, P28 | S4, S8 | Core | ★★★ | ✓ | 3 |
| F89 | **Proactive replanning** | Missed/behind/overloaded → asks where you'll move it, shades free time; hint per band | P26 | S5, S8 | Supporting | ★★★ | | 3 |
| F90 | **Gap filler** | Detects free gaps < 30 min and offers fitting items | P10 | S2, S7 | Supporting | ★★ | ✓ | 3 |
| F91 | **Prompt budget & adaptivity** | Daily budget, quiet hours, focus protection, throttling of ignored prompt types | P28, P29 | — | Core | ★★★ | ✓ | 1 |
| F92 | **Personal records** | PRs for focus, speaking, estimation, reliability — celebrated when broken | P7, P8 | All | Supporting | ★★ | | 5 |
| F93 | **Missions** | Weekly main + optional side mission with clear finish and stamp | P22, P25 | All | Supporting | ★★★ | | 5 |
| F94 | **Week Wrapped** | Weekly swipeable story cards of your week | P8, P31 | All | Supporting | ★★★ | ✓ | 5 |
| F95 | **Coach tone presets** | Calm / Direct / Playful voice across all copy | SDT | — | Supporting | ★★ | | 1 |
| F98 | **Scaffold & fade controller** | Sets Guide intensity per area from skill bands; announces fading; per-area override | P36 | All | Core | ★★★ | ✓ | 2 |
| F99 | **Self-direction rate** | Share of decisions made by you vs suggestions accepted; trend on Skills screen | P34, P35 | All | Core | ★★★ | ✓ | 2 |
| F97 | **Daily reflection question** | One rotating question at shutdown (e.g. "What made today's best block work?") | P4 | — | Optional | ★ | | 5 |

### 11.16 Summary by tier

- **Core:** F1, F2, F3, F6, F7, F8, F9, F10, F12, F14, F22, F25, F29, F30, F34, F36, F37, F38, F41–F45, F51–F55, F57, F59, F66–F69, F73–F76, F79–F81, F83, F84–F88, F91, F98, F99
- **Supporting:** F4, F5, F11, F13, F15, F16, F17, F18, F20, F23, F26, F27, F28, F31, F32, F33, F35, F39, F40, F46, F47, F48, F56, F58, F70, F71, F72, F77, F78, F82, F89, F90, F92–F95
- **Optional:** F19, F21, F49, F97
- **Removed (v0.5):** F24 AI review draft, F50 AI structure check, F96 AI Coach chat
- **Future:** F61–F65

---

## 12. UI Design

UI is part of the psychology. Every visual decision maps to a principle.

### 12.1 Visual language

| Element | Decision | Reason |
|---|---|---|
| **Tone** | Calm, low-saturation, generous whitespace | A busy UI reads as a busy life |
| **Base palette** | Warm neutral greys (paper-like light, deep slate dark) | Lets meaningful colour stand out |
| **Accent** | One muted teal for the single primary action per screen | One clear "next" |
| **Project colours** | 8 muted hues, used only as dots/bars | Identification without noise |
| **Skill colours** | None — skills use the neutral palette + band label | Skills are about you, not decoration |
| **Warning** | Amber only | Attention without alarm |
| **Red** | **Never** for misses, overdue, overload or skill drops. Destructive confirmations only | Red triggers threat/shame (P13) |
| **Success** | Soft green on completions, rung climbs, band upgrades | Competence feedback (P7, P8) |
| **Typography** | One sans-serif (Inter or similar); tabular figures for numbers | Stable timers and meters |
| **Motion** | 150ms fades; one deliberate completion animation; one for rung climb | Mark real achievement, nothing else |
| **Theme** | Light, dark, system | |

### 12.2 Layout

```
┌──────────────┬──────────────────────────────────────────────┐
│  SIDEBAR     │  MAIN                                        │
│              │  Mission: 10 blind estimates · 4/10          │
│  ● Home      │  ┌────────────────────────────────────────┐  │
│  ○ Calendar  │  │ NOW  GMAT RC block · 07:00 · 50m       │  │  ← Now card (always)
│  ○ Goals     │  │ Why: 2h behind this week; mornings 86% │  │
│  ○ Inbox  3  │  │ [ Start ]          Something else ▾    │  │
│  ○ Speak     │  └────────────────────────────────────────┘  │
│  ○ Skills    │                                              │
│  ○ Projects  │  [Screen content]                            │
│  ○ Habits    │                                              │
│  ○ Review    │                                              │
│  ──────────  │                                              │
│  What's left │  ← opens What's Left panel                   │
│  Day-fit ▓▓░ │                                              │
│  ▶ 23:41     │  ← running timer, always visible             │
│  ──────────  │                                              │
│  @harshit ▾  │  ← account menu: settings, log out           │
└──────────────┴──────────────────────────────────────────────┘
```

- **Home** replaces "Today" as the landing screen: Now card → today's timeline (calendar strip) → Today tasks → Done today.
- Phone: bottom tabs — Home · Calendar · ＋Capture · Speak · Skills; What's Left as a pull-up sheet; timer as a floating pill while running.
- Inbox count in plain grey, never a red badge.
- Mission banner: single muted line, dismissible per day.

### 12.3 Interaction rules

| Rule | Reason |
|---|---|
| Exactly one accented primary button per screen | Removes "what now" paralysis |
| Capture from anywhere in one keystroke | P10 |
| Starting a session is one click / `F` from any task, with mode pre-suggested | Starting is the hardest part |
| Session protocol ≤ 30s total, all one-click where possible | Protocol must never become the reason not to start |
| Non-destructive actions undoable (5s toast) instead of confirmations | Speed without fear |
| Nothing auto-moves; suggestions are dismissible cards | Control |
| Skill drops are shown as neutral trend lines, never alerts | Feedback, not punishment |
| Empty states instruct and encourage | Good first use |
| The Now card is always present, on every main screen | The user never has to decide "what now" alone |
| Every proactive prompt carries its action and a "Not now" | Autonomy (P28) + one-tap action |
| Every metric, card and row is tappable into an action | Information always leads somewhere |
| Guided flows: one question per screen, progress dots, skippable | Low effort, clear end |

### 12.4 Microcopy tone

Plain, warm, factual, never moralizing.

| Situation | Don't | Do |
|---|---|---|
| Day over-planned | "You're overcommitted!" | "This plan needs ~9h. You have ~6h. Move something to tomorrow?" |
| Habit missed once | "Streak broken" | (nothing — grey dot) |
| Habit missed twice | "You failed" | "Two misses. Want to do a 2-minute version today?" |
| Task aging | "Overdue!" | "Untouched for 14 days. Still want this?" |
| Task killed | "Deleted" | "Dropped. Added to your kill list." |
| Blind estimate miss | "Wrong by 57%" | "Predicted 30m · took 47m. Writing usually runs long for you." |
| Ladder step-down | "You couldn't handle 45m" | "Two sessions stopped early. Try 40m for a while?" |
| Ladder climb | "Level up! +100 XP" | "Three clean 35s. 40m unlocked." |
| Starter stopped at 5m | "Session abandoned" | "Started. That counts." |
| Speaking reveal | "11 fillers — too many" | "You guessed 4. There were 11 — mostly *basically*. One fix for next take?" |
| Retake improved | "Great job!!!" | "Take 3: fillers 9 → 4. Pace steady at 148." |
| Listen-back gate | "You must listen first" | "Have a listen first — you'll rate it more accurately." |
| Block start | "You have to start now!" | "Your GMAT block is ready when you are." |
| Missed block | "You missed your block" | "That one slipped. Want to find another slot?" |
| Goal behind | "You're failing your goal" | "Writing is 3h short this week. Thursday 16:00 is free — add it?" |
| Over-commitment | "You never keep your plans" | "You've delivered ~6h/week. Commit to 6.5h and keep it?" |
| Login failure | "Wrong password for harshit" | "Username or password is incorrect." |
| End of day | "3 tasks left" | "Day closed. 5 done, 2h 40m focused." |

### 12.5 Keyboard map

| Key | Context | Action |
|---|---|---|
| `Ctrl+K` | Anywhere | Command palette |
| `Q` | Anywhere (incl. focus) | Quick capture / park thought |
| `G T` / `G I` / `G V` / `G S` / `G P` / `G R` | Anywhere | Today / Inbox / Speak (voice) / Skills / Projects / Review |
| `J` / `K` | Lists | Move selection |
| `Enter` | Lists | Open task |
| `F` | Task selected | Start session (suggested mode) |
| `Shift+F` | Task selected | Start session — choose mode |
| `X` | Task selected | Complete |
| `T` / `S` / `E` | Task selected | To Today / Someday / Set estimate |
| `D` | Focus | Log distraction (then `I` internal / `E` external) |
| `P` | Focus | Pause (re-entry prompt) |
| `Ctrl+Enter` | Focus | Finish session |
| `N` | Anywhere | Act on Now card |
| `W` | Anywhere | Open What's Left |
| `G C` / `G O` | Anywhere | Calendar / Goals |
| `R` | Speak | Start / stop recording |
| `Space` | Speak (playback) | Play / pause |
| `1`–`5` | Speak (rating) | Rate focused rubric dimension |
| `Ctrl+Z` | Anywhere | Undo |

### 12.6 Notifications & prompts policy

Superseded by the Guide's prompt rules (§10.3, §10.7, §10.8). Summary:
- Prompts are **earned** (tied to your commitments, gaps or patterns), **actionable**, **offer choice**, and fit a **daily budget** (default 6, excluding block starts and cue cards you set).
- Scheduled block starts: heads-up at −5 min, launch at T0, at most two pushes per block.
- Nothing during focus sessions or quiet hours.
- Ignored prompt types are throttled automatically.
- No overdue alerts, streak reminders, or "you haven't opened the app" nudges — ever.

---

## 13. Screen-by-Screen Specification

### 13.1 Quick Capture (overlay)
- Centered single-line input over dimmed background; token hint row (`#project ~time !energy`). Parsed tokens become chips.
- Enter saves and closes; `Shift+Enter` saves and stays open.
- During focus: same overlay, smaller, item tagged "parked during focus".
- **Psychology:** P10, P12.

### 13.2 Inbox
- Oldest first; inline triage *Project · Today · Someday · Delete*.
- Primary: "Process inbox" — one item at a time, full-screen decision card.
- Empty: "Inbox clear."

### 13.3 Morning Plan (3 steps + check-in)
- **Check-in (every day, 1 tap):** "Energy today?" 1–5, optional sleep hours. Low energy → the app suggests a lighter plan, never a guilt message.
- **Step 0 (Mon / 1st only):** fresh-start card — "New week. 3 outcomes?" + this week's drill reminder.
- **Step 1 — Yesterday:** Done count first, then leftovers → *Keep / Back / Someday*.
- **Step 2 — Pick:** candidates (left, sorted by attention-budget deficit; under-served projects marked amber) → Today (right, "4 / 7"). Missing first action → inline prompt. Each picked task shows suggested timer mode.
- **Step 3 — Fit:** large day-fit meter (planned × multiplier vs available). Over-fit → defer candidates highlighted, not moved.
- Primary: "Start day".
- **Psychology:** P2, P5, P8, P9, P11.

### 13.4 Home (formerly Today)
- **Now card** at top (Next-Best-Action, "Why this?", "Something else").
- **Today timeline**: horizontal calendar strip with blocks, current-time marker, next block highlighted.
- Header: date · mission banner · day-fit meter.
- Main list → Evening list → collapsed "Done today (n)".
- **Task row:** checkbox · first action · project dot · estimate ("30m → ~48m") · energy icon · if-then icon · suggested mode chip ("Ladder 35" / "Starter" / "Blind").
- WIP cap: add disabled at cap — "Today is full. Finish or remove one first."

### 13.5 Focus Mode (redesigned)

```
┌────────────────────────────────────────────────────────┐
│                                              Ladder 35 │
│                                                        │
│        Last time: start with question 14               │  ← re-entry note (muted)
│                                                        │
│          Solve RC passage set 4                        │  ← task (large)
│    Goal: 3 passages done, errors logged                │  ← session goal
│                                                        │
│                    ◯  23:41                            │  ← ring + time
│                                                        │     (Blind: "Running" + pulse)
│                                                        │
│       ·  ·  ·                                          │  ← distraction dots (tiny)
│                                                        │
│   D distraction   Q park thought   P pause   ⏎ finish  │  ← key hints (muted)
└────────────────────────────────────────────────────────┘
```
- Full screen, near-empty, dark-leaning even in light theme (lower visual stimulation).
- Distractions appear as tiny dots — visible awareness, no judgement.
- Blind mode hides time entirely.
- Starter mode shows a 5-min ring; at 5 min, two equal buttons appear.
- Timebox shows remaining budget; final 2 min turns ring amber + "Wrap up".
- **After screen:** goal met (3 buttons) · quality 1–5 · re-entry note · then reveal card (Blind: estimate error; Ladder: progress toward next rung "2/3 clean at 35") · break suggestion.
- **Psychology:** P3, P4, P6, P12, P14.

### 13.6 Recovery Break
- Calm full-screen card: break length, one suggested non-screen action, countdown.
- "Back to work" primary at end; "Skip break" secondary (logged).

### 13.7 Evening Shutdown
- Step 1: leftovers → *Done / Tomorrow / Back*.
- Step 2: Done Wall — completed task cards by project colour, focus minutes, sessions, any rung climb today.
- Step 3: "Day closed." Today greyed until next morning plan.
- **Psychology:** P8; closure supports detachment.

### 13.8 Skills (new)

```
┌──────────────────────────────────────────────────────────┐
│ Skills                         Drill this week: Estimation│
├──────────────────────────────────────────────────────────┤
│ Focus Capacity        COMPETENT    35 min  ╱╱╱‾ ↑        │
│   Rung 35 · 2/3 clean · ceiling 90                       │
├──────────────────────────────────────────────────────────┤
│ Attention Control     DEVELOPING   4.6/hr  ‾╲_ ↓ (good)  │
│   70% internal · worst: 3–5 pm · Writing                 │
├──────────────────────────────────────────────────────────┤
│ Estimation  ◆ drill   DEVELOPING   ±58%    ‾‾╲ ↓ (good)  │
│   Under-estimates by 1.6× · worst: Writing               │
├──────────────────────────────────────────────────────────┤
│ Starting              COMPETENT    1.2 d   ─── →         │
├──────────────────────────────────────────────────────────┤
│ Planning              STRONG       78%     ╱‾‾ ↑         │
├──────────────────────────────────────────────────────────┤
│ Delivery              COMPETENT    64%     ─╱‾ ↑         │
├──────────────────────────────────────────────────────────┤
│ Speaking              DEVELOPING   5.2 f/m ‾╲╲ ↓ (good)  │
│   Top filler: basically · on-target 62% · rubric 3.4     │
├──────────────────────────────────────────────────────────┤
│ Reliability           COMPETENT    74%     ─╱╱ ↑         │
│   Mornings 86% kept · evenings 31% · 4 min late median   │
└──────────────────────────────────────────────────────────┘
```
- One card per skill: band label · current metric · 4-week sparkline · direction (labelled "good" or "watch", never red) · one-line diagnosis.
- Click → detail: full history, contributing sessions, insight cards, "Make this next week's drill".
- Bands described in words, no numbers-as-scores, no ranks, no comparisons to others.
- **Psychology:** P4, P6, P7.

### 13.9 Projects / Attention Budget
- Card per active project: target hours, drift bar, task counts, project-specific multiplier and estimation bias.
- "5 / 5 active" counter; activating a 6th opens "Pause which one?".

### 13.10 Habits
- 30-day dot grid; done = accent, single miss = hollow grey, second consecutive miss = amber. Consistency % on the right. No streak headline.

### 13.11 Aging Queue
- One card at a time: title, age, deferrals count, project. Buttons: *This week · Starter now · Schedule · Someday · Kill*.
- "Starter now" launches a 5-min Starter session directly.
- Kill list tab, framed positively.

### 13.12 Weekly Review & Planning (combined flow)
1. **Week Wrapped** — story cards of last week (§13.20).
2. **Outcomes** — score last week's 3 outcomes: met / partial / missed.
3. **Goals** — per goal: committed vs actual, pace status, confidence forecast (0–100%).
4. **Mission result** — drill skill metric before vs after.
5. **Skills** — all eight at a glance; choose next mission (suggested = weakest trend).
6. **Clean up** — aging queue to zero.
7. **Commitments** — Commitment Ladder suggestions per goal.
8. **Plan** — drag goal hours onto the week (§13.16); capacity check.
9. **Commit week** — freezes the plan. "Week committed. First block: Mon 07:00."
- **Psychology:** P8 (wins first), P4, P6, P9, P22, P26, P27.

### 13.13 Speaking Studio (new)

**Home**
```
┌──────────────────────────────────────────────────────────┐
│ Speak                                 5.2 fillers/min ↓  │
├──────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐            │
│  │ Impromptu  │ │ Structured │ │ Explain-It │  …         │
│  │ 60–90s     │ │ STAR · 2m  │ │ 60s        │            │
│  └────────────┘ └────────────┘ └────────────┘            │
│                                                          │
│  Suggested: Explain-It · "Assumption in CR arguments"    │
│                                  [ Start drill ]         │
│                                                          │
│  Recent takes                                            │
│  Today   Impromptu   take 3   4.1 f/m   ▶                │
│  Mon     STAR        take 1   7.8 f/m   ▶                │
│                                                          │
│  [ Then vs Now ]   [ Prompt bank ]   [ Filler profile ]  │
└──────────────────────────────────────────────────────────┘
```

**Recording**
```
┌──────────────────────────────────────────────────────────┐
│  Impromptu · take 1                          target 1:30 │
│                                                          │
│     "Describe a decision you changed your mind on."      │
│                                                          │
│   ▁▂▅▇▅▃▂▁▂▄▆▇▆▄▂▁▁▁▂▃▅▆▅▃▂                              │  ← live waveform
│                                                          │
│                    ● 0:54 / 1:30                         │
│                                                          │
│                  [ ■ Stop ]   R                          │
└──────────────────────────────────────────────────────────┘
```
- Prep countdown shown before recording (prompt visible during prep, except Impromptu which reveals at prep start).
- At target time: ring turns amber, soft cue. At 2× target: auto-stop.
- No live metrics while speaking — they would split attention.

**Listen back → Rate → Reveal**
```
┌──────────────────────────────────────────────────────────┐
│ 1. Listen    ▶ ━━━━━━━━━━━○──── 1:12   1× 1.25× 1.5×     │
├──────────────────────────────────────────────────────────┤
│ 2. Rate yourself (unlocks after listening)               │
│    Clarity ●●●○○  Structure ●●○○○  Confidence ●●●●○      │
│    Conciseness ●●●○○  Engagement ●●●○○                   │
│    Fillers you think you used:  [ 4 ]                    │
│                                         [ Reveal ]       │
├──────────────────────────────────────────────────────────┤
│ 3. Measured                                              │
│    Fillers 11 (you guessed 4) · 9.2/min · mostly "basically"
│    Pace 152 wpm · 2 long pauses · on target ✓            │
│    Transcript: "So, basically, the decision was..."      │  ← fillers highlighted, click = jump
├──────────────────────────────────────────────────────────┤
│ 4. One fix for next take: [ Drop "basically" at starts ] │
│                     [ Retake ]   [ Done ]                │
└──────────────────────────────────────────────────────────┘
```
- Steps unlock in order; the page is one vertical flow, no modals.
- Retake shows a comparison strip: take 1 → take N for each metric.
- **Psychology:** P17 (frequent low-stakes exposure), P18 (listen-back), P19 (rate before reveal), P3 (honest feedback), P6 (one fix).

**Then vs Now**
- Two players stacked: first-ever take and latest take of the same drill type, dates and metrics beside each. "Play both" plays them back to back.

### 13.14 Sign up / Log in (new)

```
┌─────────────────────────────┐
│           Plan              │
│                             │
│  Username  [ harshit      ] │
│  Password  [ ••••••••••   ] │
│                             │
│         [ Log in ]          │
│                             │
│  Forgot password · Sign up  │
└─────────────────────────────┘
```
- Sign up adds: recovery email, password (with a length meter, not complexity rules), username availability check as you type.
- Calm, one-column, no marketing on the page.
- First login → Baseline week intro: "For 7 days, just use it normally. We'll learn where you're starting from."

### 13.15 Account & Data (new)
- **Profile:** username (read-only after creation), display name, timezone, day boundary.
- **Security:** change password, log out of all devices.
- **Speaking data:** transcription consent, audio retention, list of milestone recordings.
- **Data:** export everything (JSON + audio zip); delete account (type username to confirm; red allowed here — destructive).
- **Sharing (Phase 7):** what's shared, with whom; revoke.

### 13.16 Calendar & Week Planner (new)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Week 41 · Plan                      Capacity ▓▓▓▓▓▓░░░░ 54% / 60%    │
├───────────────┬──────────────────────────────────────────────────────┤
│ TO PLACE      │      Mon     Tue     Wed     Thu     Fri     Sat     │
│               │ 07 ┌GMAT─┐ ┌GMAT─┐ ┌GMAT─┐ ┌GMAT─┐ ┌GMAT─┐          │
│ GMAT  2h ▒▒   │ 08 └─────┘ └─────┘ └─────┘ └─────┘ └─────┘          │
│ Writing 4h ▒▒ │ 10 ░░meeting░░                          ┌Write┐      │
│ Speaking 4×   │ 13                                       └─────┘      │
│               │ 16          ┌Write┐   ✦       ✦                       │  ✦ = suggested slot
│ Suggest slots │ 18 ┌Spk┐           ┌Spk┐                             │
│               │                                                      │
│               │              [ Commit week ]                         │
└───────────────┴──────────────────────────────────────────────────────┘
```
- Left rail: each active goal's weekly hours as draggable chips; chips shrink as you place them.
- Hint slots glow faintly while dragging **only in the Developing band**; later they appear on "Hint" only (§10.13).
- Capacity bar turns amber above 60%.
- **Commit week** freezes the plan into the ledger; after that, edits are revisions.
- Day view (phone): vertical timeline, current-time line, next block highlighted.
- Kept blocks settle with a soft fill; missed ones turn hollow grey (never red).

### 13.17 Goals (new)

**Goals list:** one card per active goal — type icon, title, journey-map mini-path, status (Ahead / On pace / Behind / At risk), this week's hours (committed vs actual), forecast finish.

**Goal detail**
```
┌──────────────────────────────────────────────────────────┐
│ GMAT 705+ · Outcome · by 15 Dec                 On pace  │
│ Why: "Unlocks the MBA plan."                             │
├──────────────────────────────────────────────────────────┤
│ ●━━━━━●━━━━━◐─────○─────○─────⚑                           │  ← journey map
│ CR 70%  RC 70%  CR 80%  Mock 680  Mock 700   forecast 9 Dec│
├──────────────────────────────────────────────────────────┤
│ This week   committed 8h · actual 6h 15m · kept 5/7      │
│ Lifetime    committed 64h · actual 51h · time debt 13h   │
│ ▁▃▅▆▅▇▆▅  promise vs reality (weekly bars)                │
├──────────────────────────────────────────────────────────┤
│ Obstacle: "I avoid RC when tired"                        │
│ If-then:  "If tired at 7 am → 1 Starter passage only"    │
├──────────────────────────────────────────────────────────┤
│ Confidence history: 70% → 65% → 72%                      │
│ [ Find time this week ]   [ Edit commitment ]            │
└──────────────────────────────────────────────────────────┘
```

**New goal flow:** guided WOOP sequence, one question per screen, ending with "Place this week's hours?" → opens Week Planner.

### 13.18 Commitments report (new)

- Period switcher: Week / Month / All.
- **Promise vs reality** bars per goal (committed vs actual).
- Outcome mix: Kept · Shortened · Moved · Released · Missed (neutral palette; Missed in hollow grey).
- **Kept-rate heatmap** by hour × weekday — shows where your promises hold.
- Punctuality: median minutes late.
- Commitment Ladder suggestions inline ("Commit 6.5h to Writing?").

### 13.19 Block Launcher (new)

See §10.6 sketch. Full-screen on desktop when app is focused; on phone, a full-screen sheet from the push notification. Primary "I'm ready — start"; secondary Shorten · Move · Release.

### 13.20 Week Wrapped (new)

- Opens week planning; 5–7 full-screen cards, tap/swipe to advance, progress bars at top (story format).
- Card sequence: *Your week in one number* (kept-rate) → *Best block* → *Personal record* (if any) → *Pattern you didn't know* (top insight) → *Then vs Now* (a clip or chart) → *Mission result* → *Next week's mission*.
- Ends on "Plan next week →".

---

## 14. Data Model

All user-owned tables carry `owner_id` (→ users) and are protected by row-level security through `can_read()` / ownership checks ([§8.2](#82-per-user-data-isolation)). `owner_id` and `created_at` are omitted below for brevity unless relevant.

```
-- Identity
profiles
  user_id (PK, = auth user id), username (unique, citext),
  display_name?, recovery_email, timezone, day_boundary_hour,
  created_at

settings
  owner_id, wip_cap, active_project_cap, peak_hours (json),
  aging_days, sound, theme, shutdown_reminder_time?,
  filler_words (text[]), audio_retention_days?, transcription_consent_at?

-- Planning
projects
  id, owner_id, name, color, status (active|paused|done),
  weekly_budget_minutes, visibility

tasks
  id, owner_id, project_id?, title, first_action, done_when?,
  status (inbox|today|evening|backlog|someday|done|killed),
  estimate_minutes?, energy (deep|shallow|admin)?, kind (work|speak),
  if_then_trigger?, if_then_time?, reentry_note?,
  deferral_count, first_planned_at?, first_started_at?,
  last_touched_at, completed_at?, killed_at?

day_plans
  owner_id, date, energy (1-5)?, sleep_hours?,
  available_minutes, planned_minutes, multiplier_used,
  completion_rate, opened_at, closed_at

-- Focus
sessions
  id, owner_id, task_id, mode (ladder|blind|starter|timebox),
  goal_text?, predicted_minutes?, planned_minutes?,
  started_at, ended_at, active_minutes, paused_minutes,
  outcome (completed|stopped_early|abandoned),
  goal_met (yes|partial|no)?, quality (1-5)?,
  is_clean (derived), ladder_rung?, overran (bool),
  reentry_note?, visibility

distractions
  id, session_id, at, kind (internal|external), note?

breaks
  id, after_session_id, suggested_minutes, taken (bool), actual_minutes?

ladder_state
  owner_id, current_rung, clean_count_at_rung, consecutive_abandons, updated_at

-- Speaking
speaking_prompts
  id, owner_id? (null = built-in), category, drill_type,
  text, framework (prep|star)?, project_id?, active

recordings
  id, owner_id, prompt_id?, task_id?, drill_type,
  take_number, parent_recording_id? (first take of the set),
  target_seconds, duration_seconds, audio_path, audio_deleted_at?,
  is_milestone (bool), is_baseline (bool), visibility, recorded_at

transcripts
  recording_id, provider, text, words (json: word, start_ms, end_ms, is_filler),
  created_at

speech_metrics
  recording_id, wpm, filler_count, fillers_per_min, filler_breakdown (json),
  long_pause_count, hedges_per_min, restarts, time_on_target (bool),
  vocab_variety, pitch_var?, volume_var?, structure_check?

speech_self_ratings
  recording_id, clarity, structure, confidence, conciseness, engagement,
  guessed_fillers, one_fix_text, listened_at, rated_at

-- Skills & review
skill_snapshots          -- weekly, for trends and band stability
  owner_id, week_start, skill (S1..S7), metric_value,
  sub_metrics (json), band, sample_size, visibility

drills
  owner_id, week_start, skill, target?, result_before, result_after

reviews
  id, owner_id, week_start, summary_text, closed_at, visibility

outcomes
  id, owner_id, week_start, text, result (met|partial|missed)?, visibility

habits / habit_logs
  id, owner_id, name, cadence, active / habit_id, date, done

-- Goals, calendar & commitments
goals
  id, owner_id, title, type (outcome|learning|process), target_text,
  target_value?, target_unit?, deadline?, weekly_commitment_minutes,
  why_text, woop_obstacle, woop_if_then, status (draft|active|paused|done|dropped),
  activated_at?, resolved_at?, result (met|missed)?, visibility

milestones
  id, goal_id, title, due_date?, done_at?, sort_order

goal_links
  goal_id, project_id

goal_confidence
  goal_id, week_start, confidence_pct

calendar_blocks
  id, owner_id, type (focus|speaking|ritual|buffer|recovery|fixed),
  title, task_id?, goal_id?, start_at, end_at, timer_mode?,
  if_then_text, context?, recurrence_rule?, recurrence_parent_id?,
  external_source (google)?, external_id?, status (planned|committed|done|cancelled)

commitments                 -- frozen snapshots, never updated
  id, owner_id, level (block|day|week_goal|goal), ref_id,
  committed_at, committed_start?, committed_minutes, goal_id?, snapshot (json)

commitment_revisions
  id, commitment_id, revised_at, change (moved|shortened|released|extended),
  new_start?, new_minutes?, reason?

block_outcomes
  commitment_id, outcome (kept|shortened|moved|released|missed),
  actual_minutes, minutes_late, score, assigned_at, auto (bool)

-- Guide
guide_prompts
  id, owner_id, type, shown_at, channel (in_app|push),
  outcome (acted|dismissed|ignored|snoozed), acted_at?, context (json)

nba_events                  -- Now card recommendations and choices
  id, owner_id, at, recommended (json), chosen (json)?, overridden (bool)

missions
  id, owner_id, week_start, kind (main|side), skill?, title,
  target, progress, completed_at?

personal_records
  owner_id, record_type, value, achieved_at, ref_id

setup_checklists
  id, owner_id, block_type, items (json)

coach_settings
  owner_id, tone (calm|direct|playful), daily_prompt_budget,
  quiet_start, quiet_end, push_enabled,
  guide_overrides (json: area → more|auto|less)

decision_events             -- for self-direction rate
  id, owner_id, at, area (next_task|placement|replan|timer_mode),
  source (self|suggestion_accepted|suggestion_modified)

-- Future (designed, not created in v1): see §8.3
groups, group_members, shares, feedback, co_sessions
```

**Derived (computed, not stored):** personal multiplier, start latency, interruptions/hour, estimation error & bias, goal-hit and outcome-hit rate, attention drift, aging list, consistency %, speaking calibration gap, filler profile, goal pace / time debt / forecast, kept-rate and time fidelity, prompt receptivity, insight cards.

---

## 15. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router) | Same as shm — no new learning |
| UI | Tailwind + Shadcn/UI; `cmdk` for palette | Fast, accessible primitives |
| DB | Supabase Postgres with row-level security | Multi-user isolation enforced in the database, not just the app |
| Auth | Supabase Auth (password) + username lookup layer + rate limiting | Username login on top of a proven auth provider; no hand-rolled password storage |
| Audio storage | Supabase Storage, private bucket, signed URLs | Same platform; per-user path policies |
| Recording | `MediaRecorder` (Opus/WebM); Web Audio API for waveform + local pause detection; `wavesurfer.js` for playback waveform | Browser-native; works on desktop and phone |
| Transcription | Hosted speech-to-text **with disfluency (filler) preservation and word timestamps**, behind an adapter interface | Filler metrics depend on it; adapter allows switching provider |
| Timer | Web Worker + persisted timestamps; Page Visibility API | Accurate across tab switches, sleep, refresh |
| Offline | Service worker + IndexedDB write queue | Capture, timer, recording offline |
| Charts | Lightweight sparklines (custom SVG or Recharts) | Skills, budget and speaking trends |
| Skill computation | SQL views + server functions; weekly snapshot job | Reproducible metrics from source data |
| Calendar UI | A drag-and-drop calendar component (e.g. FullCalendar standard, MIT) styled to the design system | Week/day views, drag, resize |
| Scheduling & prompts | Postgres scheduled jobs (e.g. pg_cron / edge functions) + Web Push (VAPID) via service worker | Heads-ups, block starts, escalation, weekly snapshots |
| Recommendation engine | Deterministic rules + scoring in server code; no AI | Predictable, explainable "Why this?" |
| Google Calendar | Google Calendar API (read-only first) | Fixed events → free capacity |
| Hosting | Vercel | Zero-config Next.js |

---

## 16. Build Phases

Each phase ships only after the previous one has had **one week of real daily use**.

| Phase | Scope | Features | Done when |
|---|---|---|---|
| **0 — Foundation** | Scaffold, auth (username + password), profiles, per-user RLS, social-ready conventions, shell, palette, capture, PWA | F1, F3, F25, F26, F51–F54 | Two test users can sign up and log in; each sees only their own data; capture < 2s |
| **1 — Daily loop, core timer, Guide basics** | Inbox, Today/Home with **Now card**, What's Left (day level), guided morning & shutdown rituals, coach tone, prompt budget, timer + session protocol, Focus Ladder, distraction ledger & parking, breaks, re-entry, Done Wall, baseline week, energy check-in, offline capture/timer | F2, F5–F13, F29, F33–F35, F55, F56, F58, F84, F85, F86, F91, F95 | 7 consecutive days used; ≥ 15 sessions logged with protocol; Now card acted on ≥ 50% of the time |
| **2 — Measurement → skills** | Estimates/actuals, Blind Estimate, Starter, Timebox, multiplier, attention budget, skill metrics (S1–S6), Skills screen, scaffold & fade controller, self-direction rate | F4, F14–F16, F30–F32, F36, F37, F98, F99 | S1–S6 show values with ≥ 2 weeks of data |
| **3 — Goals, Calendar & Commitments** | Typed goals with WOOP, hierarchy, pace engine, journey map, goal cap; calendar views, blocks, week planning, capacity rule, recurring blocks, placement suggestions, Google read-only import; commit & freeze, block outcomes, committed-vs-actual reports, S8; Block Launcher, start escalation, replanning, gap filler | F27 (read), F66–F71, F73–F81, F83, F87–F90 | Two committed weeks; committed vs actual visible for every goal; S8 has a value |
| **4 — Speaking Studio** | Recorder, drills & prompts, listen-back gate, blind self-rating, auto metrics, retake comparison, then vs now, filler profile, S7, data controls, export | F28, F41–F48, F59 | ≥ 3 baseline recordings + ≥ 10 drills; S7 visible |
| **5 — Training loop & fun** | Weekly review, outcome scoring, weekly drill (all 8 skills), missions, Week Wrapped, personal records, insight cards, if-then cues, habits, energy matching, aging queue, kill list, Commitment Ladder, confidence forecasts, reflection question | F17–F22, F38, F39, F57, F72, F82, F92–F94, F97 | One full mission week with before/after; two Week Wrapped + reviews completed |
| **6 — Refinement** | Fresh-start prompts, baseline re-anchoring, prosody metrics | F23, F40, F49 | 8 weeks of data; bands re-anchored |
| **7 — Pair & group learning** | Groups, shares, feedback; accountability partner, co-focus, peer speaking review, speaking circle, group goals | F61–F65 | One pair completes 2 weeks of peer review |
| **8 — Extensions** | Google Calendar two-way sync | F27 (write) | Only if real need appears |

**Ordering rationale**
- **Auth in Phase 0:** `owner_id` and row-level security must exist on every table from the first migration.
- **Guide basics in Phase 1:** the app must be active from day one — the Now card and guided rituals are cheap and define the experience. Advanced guidance (launcher, escalation, replanning) needs the calendar, so it lands in Phase 3.
- **Goals & calendar before Speaking:** they are the backbone that everything else — including speaking practice — gets scheduled into and measured against. Speaking stays independent and follows directly.
- **Fun mechanics in Phase 5:** missions, PRs and Week Wrapped need several weeks of data to be meaningful; shipping them earlier would mean empty celebrations.

---

## 17. Success Metrics

The app succeeds if **you get better**, not if you use it more.

### 17.1 Skill outcomes (primary — measured at 12 weeks vs baseline)

| Skill | Target improvement |
|---|---|
| S1 Focus Capacity | +15 min sustained rung |
| S2 Attention Control | −30% interruptions / focused hour |
| S3 Estimation | Median error roughly halved; bias closer to 1.0× |
| S4 Starting | −50% median start latency |
| S5 Planning | ≥ 70% of days in the 60–85% completion band |
| S6 Delivery | ≥ 70% session goals met; ≥ 2 of 3 weekly outcomes met on average |
| S7 Speaking | Filler rate −50%; ≥ 80% drills on target time; filler-guess calibration gap halved |
| S8 Reliability | Kept-rate ≥ 80%; time fidelity ≥ 85%; median start ≤ 5 min late |
| Goals | ≥ 70% of resolved goals met; confidence forecasts better calibrated (Brier score falling) |

### 17.2 Health metrics (secondary — is the system alive?)

| Metric | Target |
|---|---|
| Morning plan opened | ≥ 5 days / week |
| Sessions with protocol completed | ≥ 80% |
| Speaking drills | ≥ 4 / week |
| Listen-back completion | 100% (enforced) — watch for drills abandoned at listen-back |
| Weekly reviews | ≥ 3 / month |
| Inbox oldest item | ≤ 7 days |
| Attention drift | All active projects within ±30% over a month |
| Week committed | ≥ 3 of 4 weeks |
| Now card acted on | ≥ 50% of views (lower → recommendations are wrong) |
| Prompt acceptance | ≥ 40% acted; dismiss rate falling (higher dismissals → Guide is nagging) |
| **Self-direction rate** | Rising month over month; ≥ 70% by week 12 (the app is becoming less necessary) |
| Block Launcher start | ≥ 70% of blocks started from launcher by T+15 |

If health metrics are fine but skill metrics are flat after 8 weeks, the trainers are not working — that is a design problem to revisit, not a user failure.

---

## 18. Anti-Features (Deliberately Not Built)

| Not built | Why |
|---|---|
| Auto-rescheduling | Removes control; plan stops being trusted |
| Points, XP, badges, levels-for-activity | Overjustification — rewards activity, not ability. (Skill bands are allowed because they reflect measured ability and change slowly.) |
| Leaderboards / comparisons to others — including in groups | Social comparison adds anxiety, not skill; groups use cooperative goals only |
| Streak counters as headline | What-the-hell effect |
| Red badges / red skill drops | Shame → avoidance |
| Fixed Pomodoro as the only mode | Doesn't adapt to ability, so doesn't train |
| Total-hours-worked as a headline metric | Rewards time spent, not skill or output |
| Score shown before self-rating in Speaking | Removes the self-perception lesson |
| Public profiles / public recordings | Private by default; sharing is explicit, per item, revocable |
| Admin access to user content | Privacy; operations see aggregates only |
| Mandatory due dates | Fake deadlines devalue real ones (optional field only) |
| Notes / docs / wiki | Out of scope |
| Chat / social feed | Not a social network; pair/group features are structured practice only |
| Unlimited Today list | Defeats WIP principle |
| Data collected "just in case" | Violates "train, don't track" |
| Guilt notifications ("You'll lose your streak!") | Reactance and avoidance (P28) |
| Re-engagement spam ("We miss you") | Not earned by any commitment |
| Auto-placing or auto-moving calendar blocks | Removes control; the Guide only proposes |
| Overwriting original commitments | Destroys the honest record that trains reliability |
| Unlimited prompts | Habituation; the app becomes noise (P29) |
| AI that plans, decides, writes reviews or coaches for you | Doing it for you removes the practice that builds the skill (P34, P35) |
| Guidance that never fades | Creates dependence; hinders once you're competent (P36) |
| Fake urgency / countdown pressure on non-scheduled items | Manipulative; erodes trust |

---

## 19. Decisions & Defaults

| Decision | Default | Alternative |
|---|---|---|
| Scope | Tasks + timers + skills + habits + speaking | Add written communication (S8) later |
| Repo | Standalone at `D:\plan` | Section inside shm |
| Login | Username + password; email for recovery only | Email login; Google sign-in |
| Password minimum | 10 characters, breached-password check | 8 / 12 |
| Calendar | Phase 3 (Google read-only); two-way sync Phase 8 | Two-way earlier |
| Active goals cap | 5 | 3–7 |
| Capacity rule | Committed blocks ≤ 60% of free hours | 50% / 70% |
| Kept threshold | Start ≤ 10 min late and ≥ 80% of committed | Stricter / looser |
| Release lead time | ≥ 2 h before start | 1 h / 12 h |
| Daily prompt budget | 6 | 3–10 |
| Quiet hours | 22:00–07:00 | Per user |
| Coach tone | Calm | Direct / Playful |
| Week planning day | Sunday evening | Monday morning |
| Today WIP cap | 7 | 3–9 |
| Active project cap | 5 | 3–7 |
| Aging threshold | 14 days | 7 / 21 |
| Multiplier minimum sample | 10 tasks | 5 / 20 |
| Ladder start rung | 25 min (or baseline-week median if lower) | 15 / 30 |
| Ladder climb rule | 3 clean sessions | 2 / 5 |
| Clean session definition | Completed with ≤ 1 distraction | 0 distractions |
| Blind Estimate frequency (non-drill weeks) | 1 in 3 estimated tasks | Always / never |
| Band stability window | 2 weeks | 1 / 4 |
| Baseline re-anchor | After 8 weeks | 4 / 12 |
| Transcription | Hosted provider with filler preservation, behind adapter | Local model (more private, weaker filler capture) |
| Audio retention | Keep all | Auto-delete audio after 90 days, keep metrics |
| Max takes per prompt | 5 | 3 / unlimited |
| Speaking drill target | ≥ 4 / week | Daily |
| AI features | None — removed in v0.5 | — |
| Guide fading | Automatic per skill band, per-area override | Manual only |
