import 'server-only'
import { cache } from 'react'
import { getViewer } from './viewer'
import { addDays, dayOfWeek, dayRange, hoursUntilDayEnd, weekStart } from '@/domain/time/day'
import { plannedMinutesFor, suggestMode, type TimerMode } from '@/domain/focus/session'
import { attentionDrift, dayFit, personalMultiplier, type RatioSample } from '@/domain/plan/time-honesty'
import type { SkillId } from '@/domain/skills/skills'
import { loadCurrentDrill } from './training'
import { actualSecondsByTask } from './actuals'

const DAY = 86_400_000

export interface TaskView {
  id: string
  title: string
  firstAction: string | null
  status: string
  kind: string
  estimate: number | null
  energy: 'deep' | 'shallow' | 'admin' | null
  projectId: string | null
  projectName: string | null
  projectColor: string | null
  plannedFor: string | null
  deferralCount: number
  reentryNote: string | null
  createdAt: string
  actualMinutes: number
  multiplier: number
  adjustedEstimate: number | null
  mode: TimerMode
  plannedMinutes: number | null
  why: string | null
  leftover: boolean
  doneWhen: string | null
  ifThenTrigger: string | null
  ifThenMinute: number | null
  shareOverride: string | null
}

/** Deterministic 1-in-3 selection for Blind Estimate, stable per task. */
function blindDue(id: string): boolean {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % 3 === 0
}

type RawTask = {
  id: string; title: string; first_action: string | null; status: string; kind: string
  estimate_minutes: number | null; energy: string | null; project_id: string | null; planned_for: string | null
  deferral_count: number; reentry_note: string | null; created_at: string; sort_order: number
  done_when: string | null; if_then_trigger: string | null; if_then_minute: number | null; share_override: string | null
  projects: { name: string; color: string } | null
}

export const loadMultiplierSamples = cache(async (): Promise<RatioSample[]> => {
  const { supabase, now } = await getViewer()
  const since = new Date(now.getTime() - 90 * DAY).toISOString()
  const { data: done } = await supabase
    .from('tasks')
    .select('id, project_id, energy, estimate_minutes')
    .eq('status', 'done')
    .not('estimate_minutes', 'is', null)
    .gte('completed_at', since)
  if (!done?.length) return []
  const byTask = await actualSecondsByTask(supabase, done.map((t) => t.id))
  return done
    .filter((t) => (byTask.get(t.id) ?? 0) >= 60 && t.estimate_minutes)
    .map((t) => ({ ratio: (byTask.get(t.id)! / 60) / t.estimate_minutes!, projectId: t.project_id, energy: t.energy }))
})

export function toTaskView(t: RawTask, ctx: {
  rung: number; samples: RatioSample[]; actual: number; today: string; now: Date; underServed: Set<string>; drill?: SkillId | null
}): TaskView {
  const energy = t.energy as TaskView['energy']
  const ageDays = (ctx.now.getTime() - new Date(t.created_at).getTime()) / DAY
  // Weekly drill biases suggestions (DESIGN §5.3): Estimation → blind on every estimate; Starting → starter after one deferral.
  const mode = suggestMode({ energy, estimateMinutes: t.estimate_minutes, deferralCount: t.deferral_count, ageDays },
    ctx.drill === 'S3' || blindDue(t.id), ctx.drill === 'S4' ? 1 : 2)
  const m = personalMultiplier(ctx.samples, t.project_id, t.energy)
  const plannedMinutes = plannedMinutesFor(mode, ctx.rung, t.estimate_minutes)
  let why: string | null = null
  if (mode === 'starter') why = t.deferral_count >= 1 ? `Put off ${t.deferral_count === 1 ? 'once' : `${t.deferral_count} times`} — just 5 minutes to start.` : 'Waiting a while — just 5 minutes to start.'
  else if (t.project_id && ctx.underServed.has(t.project_id)) why = `${t.projects?.name} is behind its weekly time.`
  else if (mode === 'blind') why = 'Guess the time: guess first, then see how close you were.'
  else if (mode === 'ladder' && energy === 'deep') why = `Deep work — growing your focus at ${ctx.rung} min.`
  else if (mode === 'timebox') why = 'Light task — a set time so it doesn’t sprawl.'
  return {
    id: t.id, title: t.title, firstAction: t.first_action, status: t.status, kind: t.kind,
    estimate: t.estimate_minutes, energy, projectId: t.project_id,
    projectName: t.projects?.name ?? null, projectColor: t.projects?.color ?? null,
    plannedFor: t.planned_for, deferralCount: t.deferral_count, reentryNote: t.reentry_note,
    createdAt: t.created_at, actualMinutes: ctx.actual,
    multiplier: m.value,
    adjustedEstimate: t.estimate_minutes ? Math.round(t.estimate_minutes * m.value) : null,
    mode, plannedMinutes, why,
    leftover: !!t.planned_for && t.planned_for < ctx.today,
    doneWhen: t.done_when, ifThenTrigger: t.if_then_trigger, ifThenMinute: t.if_then_minute, shareOverride: t.share_override,
  }
}

export const TASK_SELECT =
  'id, title, first_action, status, kind, estimate_minutes, energy, project_id, planned_for, deferral_count, reentry_note, created_at, sort_order, done_when, if_then_trigger, if_then_minute, share_override, projects(name, color)'

export const loadWeekBudgets = cache(async () => {
  const { supabase, profile, today } = await getViewer()
  const ws = weekStart(today)
  const range = { start: dayRange(ws, profile.timezone, profile.day_boundary_hour).start, end: dayRange(addDays(ws, 6), profile.timezone, profile.day_boundary_hour).end }
  const [{ data: projects }, { data: sessions }] = await Promise.all([
    supabase.from('projects').select('id, name, color, status, weekly_budget_minutes').order('created_at'),
    supabase.from('sessions').select('active_seconds, tasks(project_id)').gte('started_at', range.start.toISOString()).lt('started_at', range.end.toISOString()).not('ended_at', 'is', null),
  ])
  const minutes = new Map<string, number>()
  for (const s of sessions ?? []) {
    const pid = s.tasks?.project_id
    if (pid) minutes.set(pid, (minutes.get(pid) ?? 0) + Math.round((s.active_seconds ?? 0) / 60))
  }
  const di = dayOfWeek(today)
  return (projects ?? []).map((p) => {
    const actual = minutes.get(p.id) ?? 0
    return { ...p, actualMinutes: actual, drift: attentionDrift(p.weekly_budget_minutes, actual, di) }
  })
})

export const loadToday = cache(async () => {
  const v = await getViewer()
  const { supabase, profile, today, now, ladder } = v
  const range = dayRange(today, profile.timezone, profile.day_boundary_hour)

  const [planRes, tasksRes, doneRes, inboxRes, openRes, sessionsRes, breaksRes, samples, budgets, drill] = await Promise.all([
    supabase.from('day_plans').select('*').eq('day', today).maybeSingle(),
    supabase.from('tasks').select(TASK_SELECT).in('status', ['today', 'evening']).order('sort_order').order('created_at'),
    supabase.from('tasks').select('id, title, project_id, projects(name, color)').eq('status', 'done')
      .gte('completed_at', range.start.toISOString()).lt('completed_at', range.end.toISOString()).order('completed_at'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'inbox').or(`hidden_until.is.null,hidden_until.lte.${today}`),
    supabase.from('sessions').select('id, task_id, mode, started_at, paused_at, paused_seconds, planned_minutes, tasks(title)').is('ended_at', null).maybeSingle(),
    supabase.from('sessions').select('id, task_id, mode, started_at, ended_at, active_seconds, outcome, is_clean, ladder_rung, tasks(project_id, projects(name, color))')
      .gte('started_at', range.start.toISOString()).lt('started_at', range.end.toISOString()).not('ended_at', 'is', null).order('started_at'),
    supabase.from('breaks').select('created_at, taken').gte('created_at', range.start.toISOString()).order('created_at'),
    loadMultiplierSamples(),
    loadWeekBudgets(),
    loadCurrentDrill(),
  ])

  const raw = (tasksRes.data ?? []) as unknown as RawTask[]
  const secs = await actualSecondsByTask(supabase, raw.map((t) => t.id))
  const actualBy = new Map([...secs].map(([id, x]) => [id, Math.round(x / 60)]))
  const underServed = new Set(budgets.filter((b) => b.status === 'active' && b.drift?.underServed).map((b) => b.id))

  const tasks = raw.map((t) => toTaskView(t, { rung: ladder.current_rung, samples, actual: actualBy.get(t.id) ?? 0, today, now, underServed, drill }))
  const main = tasks.filter((t) => t.status === 'today')
  const evening = tasks.filter((t) => t.status === 'evening')

  const sessions = sessionsRes.data ?? []
  const lastTakenBreak = (breaksRes.data ?? []).filter((b) => b.taken).at(-1)?.created_at
  const sessionsSinceBreak = sessions.filter((s) => s.outcome !== 'abandoned' && (!lastTakenBreak || (s.ended_at ?? '') > lastTakenBreak)).length
  const focusMinutes = Math.round(sessions.reduce((a, s) => a + (s.active_seconds ?? 0), 0) / 60)

  const plan = planRes.data
  const available = plan?.available_minutes ?? v.settings.default_available_minutes
  const fit = dayFit(tasks.filter((t) => !t.leftover).map((t) => ({ estimateMinutes: t.estimate, multiplier: t.multiplier })), available)

  return {
    plan,
    dayPlanned: !!plan?.opened_at,
    dayClosed: !!plan?.closed_at,
    main,
    evening,
    leftovers: tasks.filter((t) => t.leftover),
    done: doneRes.data ?? [],
    inboxCount: inboxRes.count ?? 0,
    openSession: openRes.data
      ? {
          id: openRes.data.id, taskId: openRes.data.task_id, taskTitle: openRes.data.tasks?.title ?? 'your task',
          mode: openRes.data.mode, startedAt: openRes.data.started_at, pausedAt: openRes.data.paused_at,
          pausedSeconds: openRes.data.paused_seconds, plannedMinutes: openRes.data.planned_minutes,
        }
      : null,
    sessions,
    sessionsSinceBreak,
    focusMinutes,
    fit,
    budgets,
    hoursLeft: hoursUntilDayEnd(now, profile.timezone, profile.day_boundary_hour),
    drill,
  }
})

export type Today = Awaited<ReturnType<typeof loadToday>>
