import 'server-only'
import ical from 'node-ical'
import { getViewer, type Viewer } from './viewer'
import { addDays, dayOfWeek, dayRange, localDayMinute, weekStart, zonedToUtc } from '@/domain/time/day'
import { blockOutcome, freeMinutesInWindow } from '@/domain/calendar/blocks'

const MIN = 60_000

export interface BlockView {
  id: string
  type: string
  title: string
  taskId: string | null
  goalId: string | null
  seriesId: string | null
  start: string
  end: string
  timerMode: string | null
  ifThen: string | null
  status: 'planned' | 'committed' | 'cancelled'
  external: boolean
  outcome: string | null
  started: boolean
  /** Project that gives the block its colour. */
  subject: Subject | null
}
type Subject = { id: string; name: string; color: string }

/** Materialise recurring series into concrete blocks for a date range (idempotent). */
async function materializeSeries(v: Viewer, fromKey: string, days: number) {
  const { supabase, profile } = v
  const { data: series } = await supabase.from('block_series').select('*').eq('active', true)
  if (!series?.length) return
  const rows: { type: string; title: string; task_id: string | null; goal_id: string | null; project_id: string | null; series_id: string; start_at: string; end_at: string; timer_mode: string | null; status: string }[] = []
  for (let i = 0; i < days; i++) {
    const key = addDays(fromKey, i)
    const dow = dayOfWeek(key)
    const [y, m, d] = key.split('-').map(Number) as [number, number, number]
    for (const s of series) {
      if (!s.weekdays.includes(dow)) continue
      const start = new Date(zonedToUtc(y, m, d, 0, profile.timezone).getTime() + s.start_minute * MIN)
      if (start.getTime() < Date.now() - 60 * MIN) continue
      rows.push({
        type: s.type, title: s.title, task_id: s.task_id, goal_id: s.goal_id, project_id: s.project_id, series_id: s.id,
        start_at: start.toISOString(), end_at: new Date(start.getTime() + s.duration_minutes * MIN).toISOString(),
        timer_mode: s.timer_mode, status: 'planned',
      })
    }
  }
  if (rows.length) await supabase.from('calendar_blocks').upsert(rows, { onConflict: 'series_id,start_at', ignoreDuplicates: true })
}

/** Read-only import of fixed events from the user's private iCal link (free; no OAuth). */
export async function syncIcs(v: Viewer, force = false) {
  const { supabase, settings, userId } = v
  if (!settings.ics_url) return
  const fresh = settings.ics_fetched_at && Date.now() - new Date(settings.ics_fetched_at).getTime() < 15 * MIN
  if (fresh && !force) return
  try {
    const data = await ical.async.fromURL(settings.ics_url)
    const from = new Date(Date.now() - 86_400_000)
    const to = new Date(Date.now() + 21 * 86_400_000)
    const rows: { owner_id: string; type: string; title: string; start_at: string; end_at: string; external_uid: string; status: string }[] = []
    for (const ev of Object.values(data)) {
      if (!ev || ev.type !== 'VEVENT') continue
      for (const inst of ical.expandRecurringEvent(ev, { from, to })) {
        if (inst.isFullDay || inst.end <= inst.start) continue
        const s = inst.summary as unknown
        const title = typeof s === 'string' ? s : (s as { val?: string } | null)?.val ?? 'Busy'
        rows.push({
          owner_id: userId, type: 'fixed', title: title.slice(0, 200), status: 'planned',
          start_at: inst.start.toISOString(), end_at: inst.end.toISOString(), external_uid: String(ev.uid ?? title).slice(0, 300),
        })
      }
    }
    await supabase.from('calendar_blocks').delete().eq('type', 'fixed').not('external_uid', 'is', null).gte('start_at', from.toISOString())
    if (rows.length) await supabase.from('calendar_blocks').upsert(rows, { onConflict: 'owner_id,external_uid,start_at', ignoreDuplicates: true })
  } catch {
    // Unreachable or invalid feed: keep previous events; retry on next interval.
  }
  await supabase.from('settings').update({ ics_fetched_at: new Date().toISOString() }).eq('owner_id', userId)
}

/** Assign final outcomes to committed blocks that have ended (or were cancelled). */
export async function finalizeOutcomes(v: Viewer) {
  const { supabase, now } = v
  const cutoff = new Date(now.getTime() - 15 * MIN).toISOString()
  const { data: commitments } = await supabase.from('commitments')
    .select('id, block_id, committed_start, committed_minutes, calendar_blocks(id, start_at, end_at, status, cancelled_at, cancel_reason, block_outcomes(block_id))')
    // Newest first and bounded in time: an unordered capped scan would eventually return only already-final rows.
    .eq('level', 'block').lte('committed_start', now.toISOString())
    .gte('committed_start', new Date(now.getTime() - 45 * 86_400_000).toISOString())
    .order('committed_start', { ascending: false }).limit(500)
  const pending = (commitments ?? []).filter((c) => {
    const b = c.calendar_blocks
    // Reverse embed over a composite FK comes back as an array.
    if (!b || (b.block_outcomes as unknown[]).length > 0) return false
    return b.status === 'cancelled' || b.end_at <= cutoff
  })
  if (!pending.length) return
  const ids = pending.map((c) => c.block_id!)
  const [{ data: sessions }, { data: revisions }] = await Promise.all([
    supabase.from('sessions').select('block_id, started_at, active_seconds').in('block_id', ids).not('ended_at', 'is', null),
    supabase.from('commitment_revisions').select('commitment_id, change').in('commitment_id', pending.map((c) => c.id)),
  ])
  const rows = []
  for (const c of pending) {
    const b = c.calendar_blocks!
    const r = blockOutcome({
      committedStart: new Date(c.committed_start!), committedMinutes: c.committed_minutes,
      currentStart: new Date(b.start_at), currentEnd: new Date(b.end_at),
      moved: (revisions ?? []).some((x) => x.commitment_id === c.id && x.change === 'moved'),
      cancelled: b.status === 'cancelled' && b.cancelled_at ? { at: new Date(b.cancelled_at), reason: b.cancel_reason } : null,
      sessions: (sessions ?? []).filter((s) => s.block_id === b.id).map((s) => ({ startedAt: new Date(s.started_at), activeSeconds: s.active_seconds ?? 0 })),
      now,
    })
    if (r) rows.push({ block_id: b.id, outcome: r.outcome, actual_minutes: r.actualMinutes, minutes_late: r.minutesLate, score: r.score })
  }
  if (rows.length) await supabase.from('block_outcomes').upsert(rows, { onConflict: 'block_id', ignoreDuplicates: true })
}

const BLOCK_SELECT = 'id, type, title, task_id, goal_id, series_id, start_at, end_at, timer_mode, if_then_text, status, external_uid, block_outcomes(outcome), sessions(id), projects(id, name, color), tasks(projects(id, name, color)), goals(goal_projects(projects(id, name, color)))'

function toView(b: {
  id: string; type: string; title: string; task_id: string | null; goal_id: string | null; series_id: string | null
  start_at: string; end_at: string; timer_mode: string | null; if_then_text: string | null; status: string; external_uid: string | null
  block_outcomes: { outcome: string }[]; sessions: { id: string }[]
  projects: Subject | null
  tasks: { projects: Subject | null } | null
  goals: { goal_projects: { projects: Subject | null }[] } | null
}): BlockView {
  // Subject colour: the block's own project, else the task's, else the goal's first project.
  const subject = b.projects ?? b.tasks?.projects ?? b.goals?.goal_projects.find((g) => g.projects)?.projects ?? null
  return {
    id: b.id, type: b.type, title: b.title, taskId: b.task_id, goalId: b.goal_id, seriesId: b.series_id,
    start: b.start_at, end: b.end_at, timerMode: b.timer_mode, ifThen: b.if_then_text,
    status: b.status as BlockView['status'], external: !!b.external_uid,
    outcome: b.block_outcomes[0]?.outcome ?? null, started: b.sessions.length > 0,
    subject: subject ? { id: subject.id, name: subject.name, color: subject.color } : null,
  }
}

export async function loadBlocksBetween(from: Date, to: Date): Promise<BlockView[]> {
  const { supabase } = await getViewer()
  const { data } = await supabase.from('calendar_blocks').select(BLOCK_SELECT)
    .lt('start_at', to.toISOString()).gt('end_at', from.toISOString()).neq('status', 'cancelled').order('start_at')
  return (data ?? []).map((b) => toView(b as never))
}

export async function loadWeek(weekKey: string) {
  const v = await getViewer()
  const { profile, settings, supabase } = v
  await Promise.all([materializeSeries(v, weekKey, 7), syncIcs(v), finalizeOutcomes(v)])
  const from = dayRange(weekKey, profile.timezone, 0).start
  const to = dayRange(addDays(weekKey, 6), profile.timezone, 0).end
  const blocks = await loadBlocksBetween(from, to)

  // Free minutes = waking window per day minus fixed events (DESIGN §9.3 capacity rule).
  let freeMinutes = 0
  for (let i = 0; i < 7; i++) {
    const [y, m, d] = addDays(weekKey, i).split('-').map(Number) as [number, number, number]
    const ws = zonedToUtc(y, m, d, settings.day_start_hour, profile.timezone)
    const we = zonedToUtc(y, m, d, Math.min(settings.day_end_hour, 23), profile.timezone)
    const wEnd = settings.day_end_hour === 24 ? new Date(we.getTime() + 60 * MIN) : we
    freeMinutes += freeMinutesInWindow(ws, wEnd, blocks.filter((b) => b.type === 'fixed').map((b) => ({ start: new Date(b.start), end: new Date(b.end) })))
  }
  const plannedMinutes = blocks
    .filter((b) => b.type !== 'fixed' && b.type !== 'buffer')
    .reduce((a, b) => a + (new Date(b.end).getTime() - new Date(b.start).getTime()) / MIN, 0)

  const { data: goalCommits } = await supabase.from('commitments').select('goal_id').eq('level', 'week_goal').eq('week_start', weekKey)
  return { blocks, freeMinutes, plannedMinutes: Math.round(plannedMinutes), weekCommitted: (goalCommits?.length ?? 0) > 0 || blocks.some((b) => b.status === 'committed') }
}

export function currentWeekKey(today: string) {
  return weekStart(today)
}

export interface MonthDay { key: string; plannedMinutes: number; keptMinutes: number; finished: number; kept: number; colors: string[] }

/** One month at a glance: planned and kept minutes per day, and which subjects appear. */
export async function loadMonth(monthKey: string): Promise<MonthDay[]> {
  const v = await getViewer()
  const { profile } = v
  const first = `${monthKey}-01`
  const [y, m] = monthKey.split('-').map(Number) as [number, number]
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate()
  await materializeSeries(v, first, daysIn)
  const blocks = await loadBlocksBetween(dayRange(first, profile.timezone, 0).start, dayRange(addDays(first, daysIn - 1), profile.timezone, 0).end)
  const byDay = new Map<string, MonthDay>()
  for (let i = 0; i < daysIn; i++) {
    const key = addDays(first, i)
    byDay.set(key, { key, plannedMinutes: 0, keptMinutes: 0, finished: 0, kept: 0, colors: [] })
  }
  for (const b of blocks) {
    if (b.type === 'fixed' || b.type === 'buffer') continue
    const day = byDay.get(localDayMinute(new Date(b.start), profile.timezone).key)
    if (!day) continue
    const mins = Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / MIN)
    day.plannedMinutes += mins
    if (b.outcome && b.outcome !== 'released') {
      day.finished++
      if (b.outcome === 'kept') { day.kept++; day.keptMinutes += mins }
    }
    const c = b.subject?.color
    if (c && !day.colors.includes(c) && day.colors.length < 5) day.colors.push(c)
  }
  return [...byDay.values()]
}
