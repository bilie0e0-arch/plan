import Link from 'next/link'
import { getViewer } from '@/lib/data/viewer'
import { loadToday } from '@/lib/data/today'
import { loadSkills } from '@/lib/data/skills'
import { loadList } from '@/lib/data/lists'
import { nowCard, mayShowPrompt } from '@/domain/guide/now-card'
import { dayOfWeek, dayRange, localDayMinute, weekStart } from '@/domain/time/day'
import { gapBeforeNext } from '@/domain/calendar/blocks'
import { finalizeOutcomes, loadBlocksBetween } from '@/lib/data/calendar'
import { say } from '@/domain/guide/copy'
import { NudgeCard } from '@/components/guide/nudge-card'
import { NextUp } from '@/components/guide/next-up'
import { loadAging, loadHabits, loadMissions, syncRecords } from '@/lib/data/training'
import { freshStart, reviewWeeks } from '@/domain/training/week'
import { RecordMoment } from '@/components/training/record-moment'
import { Onboarding } from '@/components/training/onboarding'
import { DailyMode, PartnerLine } from '@/components/partner/daily-mode'
import { AddBox } from '@/components/today/add-box'
import { DayDial } from '@/components/today/day-dial'
import { workKind } from '@/domain/setup/work-kind'
import { NowBanner } from '@/components/today/now-banner'
import { TaskCard } from '@/components/today/task-card'
import { ProjectDot } from '@/components/tasks/task-chips'
import { fmtMinutes } from '@/lib/format'
import type { PartnerSnapshot } from '@/lib/data/partner'

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/**
 * Today (UI v0.6): greet → one friendly banner at most → add a task → tasks with ▶ → four tiles.
 * Built to fit one screen: extras live in tiles, finished tasks fold into one line.
 */
export default async function TodayPage() {
  const v = await getViewer()
  await finalizeOutcomes(v)
  const range = dayRange(v.today, v.profile.timezone, v.profile.day_boundary_hour)
  const { planWeek } = reviewWeeks(v.today)
  const areas = v.settings.focus_areas
  const [t, s, blocks, records, missions, habits, aging, reviewRes, spokeToday, extraCues, counts, invitesDone, snapRes, ideas] = await Promise.all([
    loadToday(), loadSkills(), loadBlocksBetween(range.start, range.end), syncRecords(v),
    loadMissions(weekStart(v.today)), loadHabits(7), loadAging(),
    v.supabase.from('reviews').select('closed_at').eq('week_start', planWeek).maybeSingle(),
    v.supabase.from('recordings').select('id', { count: 'exact', head: true }).gte('recorded_at', range.start.toISOString()),
    v.supabase.from('tasks').select('id, title, if_then_trigger, if_then_minute').in('status', ['inbox', 'backlog'])
      .not('if_then_minute', 'is', null).or(`hidden_until.is.null,hidden_until.lte.${v.today}`).limit(20),
    Promise.all([
      v.supabase.from('goals').select('id', { count: 'exact', head: true }),
      v.supabase.from('recordings').select('id', { count: 'exact', head: true }),
      v.supabase.from('reviews').select('week_start', { count: 'exact', head: true }).not('closed_at', 'is', null),
    ]),
    v.supabase.from('guide_prompts').select('type').like('type', 'invite_%').neq('outcome', 'shown'),
    v.supabase.rpc('friends_snapshot'),
    loadList('inbox', false),
  ])
  const friends = ((snapRes.data ?? []) as unknown as PartnerSnapshot[]).map((f) => ({
    id: f.user_id, name: f.display_name || `@${f.username}`, online: !!f.presence && f.presence.status !== 'offline',
  }))

  // ───── Guide context ─────
  const nowMs = v.now.getTime()
  const actionable = blocks.filter((b) => !['fixed', 'buffer'].includes(b.type) && !b.outcome)
  const active = actionable.find((b) => new Date(b.start).getTime() <= nowMs && new Date(b.end).getTime() > nowMs && !b.started && nowMs - new Date(b.start).getTime() < 15 * 60_000)
  const soon = actionable.find((b) => { const m = (new Date(b.start).getTime() - nowMs) / 60_000; return m > 0 && m <= 5 && !b.started })
  const missed = actionable.filter((b) => !b.started && nowMs - new Date(b.start).getTime() >= 15 * 60_000)
  const upcoming = actionable.find((b) => { const m = (new Date(b.start).getTime() - nowMs) / 60_000; return m > 5 && m <= 120 && !b.started })
  const nextBlock = actionable.find((b) => new Date(b.start).getTime() > nowMs && !b.started)
  const gap = gapBeforeNext(v.now, blocks.filter((b) => b.type !== 'fixed').map((b) => ({ start: new Date(b.start), end: new Date(b.end) })))
  const list = [...t.main, ...t.evening].filter((x) => !x.leftover)
  const card = nowCard({
    tone: v.tone, level: s.levels.now_card,
    openSession: t.openSession ? { taskTitle: t.openSession.taskTitle } : null,
    dayPlanned: t.dayPlanned, dayClosed: t.dayClosed,
    todayTasks: t.main.filter((x) => !x.leftover).map((x) => ({ id: x.id, title: x.firstAction || x.title, mode: x.mode, plannedMinutes: x.plannedMinutes, why: x.why })),
    sessionsSinceBreak: t.sessionsSinceBreak, inboxCount: t.inboxCount, hoursUntilDayEnd: t.hoursLeft,
    activeBlock: active ? { id: active.id, title: active.title, type: active.type } : null,
    soonBlock: soon ? { id: soon.id, title: soon.title, inMinutes: Math.ceil((new Date(soon.start).getTime() - nowMs) / 60_000) } : null,
    gapMinutes: gap,
  })
  // A day doesn't have to be "planned" to start: with tasks on Today, skip the plan-first banner.
  const bannerCard = ['start_task', 'pick_task', 'resume'].includes(card.kind) || (card.kind === 'plan_day' && list.length > 0) || (card.kind === 'empty') ? null : card
  const suggestedId = card.kind === 'start_task' && s.levels.now_card === 'full' ? card.task?.id ?? null : null

  // ───── One budgeted prompt ─────
  const nowMinute = localDayMinute(v.now, v.profile.timezone).minute
  const cueWindow = (m: number) => nowMinute >= m - 30 && nowMinute <= m + 60
  const cues = [
    ...list.filter((x) => x.ifThenTrigger && x.ifThenMinute != null && cueWindow(x.ifThenMinute)).map((x) => ({ id: x.id, minute: x.ifThenMinute!, text: x.ifThenTrigger! })),
    ...(extraCues.data ?? []).filter((x) => x.if_then_trigger && cueWindow(x.if_then_minute!)).map((x) => ({ id: x.id, minute: x.if_then_minute!, text: x.if_then_trigger! })),
  ].sort((a, b) => a.minute - b.minute)
  const { data: history } = await v.supabase.from('guide_prompts').select('type, outcome, shown_on').order('shown_on', { ascending: false }).limit(60)
  const hist = (history ?? []).map((h) => ({ type: h.type, outcome: h.outcome as 'shown' | 'acted' | 'dismissed', shownOn: h.shown_on }))
  const resolvedToday = new Set(hist.filter((h) => h.shownOn === v.today && h.outcome !== 'shown').map((h) => h.type))
  const invitesResolved = new Set((invitesDone.data ?? []).map((x) => x.type))
  const [goalCount, recCount, closedReviews] = counts.map((c) => c.count ?? 0) as [number, number, number]
  const behind = t.budgets.find((b) => b.status === 'active' && b.drift?.underServed)
  const fresh = freshStart(v.today)
  const reviewDue = dayOfWeek(v.today) >= 4 && !reviewRes.data?.closed_at
  const invites = [
    { type: 'invite_review', when: v.daysSinceSignup >= 7 && closedReviews === 0, message: 'Your first week is done. Want to see how it went?', actionLabel: 'Open weekly review', href: '/review' },
    { type: 'invite_goal', when: areas.includes('planning') && goalCount === 0 && v.daysSinceSignup >= 1, message: 'Turn one big aim into weekly hours you can keep?', actionLabel: 'Create a goal', href: '/goals/new' },
    { type: 'invite_habit', when: areas.includes('habits') && habits.length === 0, message: 'Pick one small habit to keep most days?', actionLabel: 'Add a habit', href: '/habits' },
    { type: 'invite_speak', when: areas.includes('speaking') && recCount === 0, message: 'Record a one-minute baseline — your “then” for later?', actionLabel: 'Record now', href: '/speak/drill?type=impromptu' },
  ].filter((i) => i.when && !invitesResolved.has(i.type))
  const candidates: { type: string; message: string; actionLabel: string; href: string }[] = []
  if (fresh && !reviewRes.data?.closed_at) candidates.push({ type: 'fresh_start', message: say(v.tone, fresh === 'month' ? 'fresh_month' : 'fresh_week'), actionLabel: 'Start review', href: '/review' })
  if (missed.length && !t.dayClosed) {
    candidates.push(missed.length > 1
      ? { type: 'replan', message: `${missed.length} blocks slipped today. Re-flow the rest of the day?`, actionLabel: 'See the new plan', href: '/calendar?reflow=1' }
      : { type: 'replan', message: say(v.tone, 'missed_block', { title: missed[0]!.title }), actionLabel: 'Move it', href: `/calendar?move=${missed[0]!.id}` })
  }
  if (!t.dayClosed && behind) candidates.push({ type: 'under_served', message: `${behind.name} is behind its weekly time. Add something from it?`, actionLabel: 'Open projects', href: '/projects' })
  if (reviewDue && areas.includes('planning')) candidates.push({ type: 'review_due', message: 'Plan next week in a 10-minute review?', actionLabel: 'Start review', href: '/review' })
  if (t.inboxCount > 10) candidates.push({ type: 'inbox', message: `${t.inboxCount} ideas waiting. Sort them in 5 minutes?`, actionLabel: 'Sort ideas', href: '/inbox?process=1' })
  if (aging.length >= 3) candidates.push({ type: 'aging', message: `${aging.length} tasks untouched for ${v.settings.aging_days}+ days. Decide on them?`, actionLabel: 'Decide', href: '/aging' })
  if (v.settings.onboarded_at) candidates.push(...invites)
  const nudge = candidates.find((n) => !resolvedToday.has(n.type) && mayShowPrompt(n.type, v.today, dayOfWeek(v.today), hist, v.settings.daily_prompt_budget)) ?? null

  const mission = missions.find((m) => m.kind === 'main')
  const showDaily = !!(friends.length && v.settings.onboarded_at && v.settings.work_mode_on !== v.today)
  const speakEmphasis = (mission?.skill === 'S7' || areas.includes('speaking')) && !spokeToday.count && list.length > 0
  const banner: 'daily' | 'now' | 'cue' | 'nudge' | 'next' | 'speak' | null =
    showDaily ? 'daily' : bannerCard ? 'now' : cues[0] ? 'cue' : nudge ? 'nudge' : upcoming ? 'next' : speakEmphasis ? 'speak' : null

  // ───── Header & tiles ─────
  const doneN = t.done.length
  const totalN = doneN + list.length
  // Day dial target: the setup answer, else today's estimates, else two hours.
  const estimates = list.reduce((a, x) => a + (x.estimate ?? x.plannedMinutes ?? 0), 0)
  const dayTarget = v.settings.daily_focus_minutes ?? (estimates >= 30 ? estimates : 120)
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: v.profile.timezone }).format(v.now))
  const name = v.profile.display_name || v.profile.username
  const greeting = h < 12 ? `Good morning, ${name} ☀️` : h < 17 ? `Good afternoon, ${name} 🌤️` : `Good evening, ${name} 🌙`
  const sub = t.dayClosed ? 'Day closed. Rest well 🌙' : doneN === 0 && t.focusMinutes ? `${fmtMinutes(t.focusMinutes)} of ${fmtMinutes(dayTarget)} focused — keep going ✨` : doneN === 0 ? (list.length ? 'One thing at a time — press ▶ to begin.' : 'What’s one thing you want to get done today?')
    : doneN === totalN ? 'Everything done. Lovely day 🌿' : `${doneN} done${t.focusMinutes ? ` · ${fmtMinutes(t.focusMinutes)} focused` : ''} — nice momentum ✨`
  const dateLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: v.profile.timezone }).format(v.now)
  const dueHabits = habits.filter((x) => x.active && (x.dueToday || x.doneToday))
  const habitsDone = dueHabits.filter((x) => x.doneToday).length
  const evening = t.hoursLeft <= 3 && !t.dayClosed && t.dayPlanned
  const projects = t.budgets.map((b) => ({ id: b.id, name: b.name, color: b.color }))
  const running = t.openSession
    ? { taskId: t.openSession.taskId, startedAt: t.openSession.startedAt, pausedAt: t.openSession.pausedAt, pausedSeconds: t.openSession.pausedSeconds, plannedMinutes: t.openSession.plannedMinutes, mode: t.openSession.mode }
    : null

  const tiles = [
    mission
      ? { href: '/skills', emoji: '🎯', title: 'Mission', sub: `${mission.progress} of ${mission.target}${mission.done ? ' ✓' : ''}`, tint: 'bg-sun-soft' }
      : { href: '/review', emoji: '🎯', title: 'Mission', sub: 'Pick one for the week', tint: 'bg-sun-soft' },
    dueHabits.length
      ? { href: '/habits', emoji: '🌿', title: 'Habits', sub: `${habitsDone} of ${dueHabits.length} today`, tint: 'bg-leaf-soft' }
      : { href: '/habits', emoji: '🌿', title: 'Habits', sub: 'Add a small one', tint: 'bg-leaf-soft' },
    nextBlock
      ? { href: `/launch/${nextBlock.id}`, emoji: '🗓️', title: 'Next block', sub: `${nextBlock.title} · ${hhmm(localDayMinute(new Date(nextBlock.start), v.profile.timezone).minute)}`, tint: 'bg-sky-soft' }
      : { href: '/calendar', emoji: '🗓️', title: 'Plan', sub: 'Plan your week', tint: 'bg-sky-soft' },
    evening
      ? { href: '/shutdown', emoji: '🌆', title: 'Close the day', sub: 'See what you did', tint: 'bg-lilac-soft' }
      : !t.dayPlanned && list.length === 0
        ? { href: '/plan', emoji: '🗺️', title: 'Plan my day', sub: '3 quick steps', tint: 'bg-lilac-soft' }
        : { href: '/speak/drill?type=impromptu', emoji: '🎤', title: 'Speak', sub: '1-minute drill', tint: 'bg-lilac-soft' },
  ]

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-muted-foreground">{dateLabel}</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{greeting}</h1>
          <p className="mt-0.5 text-muted-foreground">{sub}</p>
        </div>
        <DayDial minutes={t.focusMinutes} target={dayTarget} running={running ? { startedAt: running.startedAt, pausedAt: running.pausedAt, pausedSeconds: running.pausedSeconds } : null} />
      </header>

      {!v.settings.onboarded_at && <Onboarding />}
      <RecordMoment records={records} tone={v.tone} />
      {friends.length > 0 && <PartnerLine friends={friends} />}

      {banner === 'daily' && <DailyMode friends={friends} />}
      {banner === 'now' && bannerCard && <NowBanner card={bannerCard} />}
      {banner === 'cue' && (
        <div className="flex items-center gap-3 rounded-2xl bg-accent px-4 py-3 animate-pop">
          <span className="text-2xl" aria-hidden>⚡</span>
          <span className="font-extrabold tabular">{hhmm(cues[0]!.minute)}</span>
          <span className="min-w-0 flex-1 truncate">{cues[0]!.text}</span>
          <Link href={`/focus?task=${cues[0]!.id}`} className="rounded-xl bg-card px-4 py-2 text-sm font-bold shadow-soft">Start</Link>
        </div>
      )}
      {banner === 'nudge' && nudge && <NudgeCard {...nudge} />}
      {banner === 'next' && upcoming && <NextUp id={upcoming.id} title={upcoming.title} startIso={upcoming.start} sound={v.settings.sound_enabled} />}
      {banner === 'speak' && <Link href="/speak/drill?type=impromptu" className="block rounded-2xl bg-lilac-soft px-4 py-3 font-bold">🎤 {say(v.tone, 'speak_drill')}</Link>}

      <AddBox ideas={ideas.slice(0, 4).map((i) => ({ id: i.id, title: i.title }))} examples={workKind(v.settings.work_kind).examples} showExamples={list.length < 3} pulse={totalN === 0 && !!v.settings.onboarded_at} />

      <section className="space-y-2" aria-label="Today">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold">Today <span className="text-sm font-bold text-muted-foreground tabular">{list.length}/{v.settings.wip_cap}</span></h2>
          {list.length >= 2 && !t.openSession && (
            <Link href="/focus?run=1" className="rounded-xl bg-muted px-3 py-1.5 text-sm font-bold hover:bg-accent">▶ Start my list</Link>
          )}
        </div>
        {list.length === 0 ? (
          <div className="rounded-2xl bg-card px-4 py-6 text-center shadow-soft">
            <p className="text-3xl" aria-hidden>🌤️</p>
            <p className="font-extrabold">A fresh start.</p>
            <p className="text-sm text-muted-foreground">Add one thing above — then press ▶ to begin.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((x) => (
              <TaskCard key={x.id} task={x} rung={v.ladder.current_rung} projects={projects}
                running={running && running.taskId === x.id ? running : null} otherRunning={!!running && running.taskId !== x.id}
                suggested={x.id === suggestedId} why={x.id === suggestedId ? x.why : null} />
            ))}
          </ul>
        )}
        {(t.done.length > 0 || t.leftovers.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {t.done.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer list-none rounded-full bg-leaf-soft px-3 py-1.5 font-bold">✓ {t.done.length} done today</summary>
                <ul className="mt-2 space-y-1 pl-2">
                  {t.done.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 text-muted-foreground line-through decoration-muted-foreground/40"><ProjectDot color={d.projects?.color ?? null} />{d.title}</li>
                  ))}
                </ul>
              </details>
            )}
            {t.leftovers.length > 0 && <Link href="/plan" className="rounded-full bg-warning-muted px-3 py-1.5 font-bold text-warning-foreground">{t.leftovers.length} left from before → decide</Link>}
          </div>
        )}
      </section>

      <nav aria-label="More for today" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {tiles.map((x) => (
          <Link key={x.title} href={x.href} className={`rounded-2xl p-3.5 transition-transform duration-150 hover:-translate-y-0.5 ${x.tint}`}>
            <span className="text-xl" aria-hidden>{x.emoji}</span>
            <span className="mt-1 block font-extrabold">{x.title}</span>
            <span className="block truncate text-xs font-semibold text-muted-foreground">{x.sub}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
