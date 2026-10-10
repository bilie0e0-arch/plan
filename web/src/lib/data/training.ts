import 'server-only'
import { cache } from 'react'
import { getViewer, type Viewer } from './viewer'
import { addDays, dayKey, dayOfWeek, dayRange, localDayMinute, weekStart } from '@/domain/time/day'
import { habitGrid } from '@/domain/training/habits'
import { MISSIONS, missionProgress, type WeekActivity } from '@/domain/training/missions'
import { detectRecords, type RecordCandidate, type RecordType } from '@/domain/training/records'
import { deliveredWeek, type GoalWeek } from '@/domain/training/commitments'
import { computeInsights, type InsightData } from '@/domain/training/insights'
import type { SkillId } from '@/domain/skills/skills'
import { actualSecondsByTask } from './actuals'

const DAY = 86_400_000

export function weekRange(v: Pick<Viewer, 'profile'>, weekKey: string) {
  return {
    start: dayRange(weekKey, v.profile.timezone, v.profile.day_boundary_hour).start,
    end: dayRange(addDays(weekKey, 6), v.profile.timezone, v.profile.day_boundary_hour).end,
  }
}

/** What happened in a week, in the shape mission progress needs. */
export async function loadWeekActivity(v: Viewer, weekKey: string): Promise<WeekActivity> {
  const { start, end } = weekRange(v, weekKey)
  const [s, d, r, o] = await Promise.all([
    v.supabase.from('sessions').select('mode, outcome, is_clean, active_seconds, goal_met, distractions(id)')
      .gte('started_at', start.toISOString()).lt('started_at', end.toISOString()).not('ended_at', 'is', null),
    v.supabase.from('day_plans').select('day', { count: 'exact', head: true }).gte('day', weekKey).lte('day', addDays(weekKey, 6)).not('closed_at', 'is', null),
    v.supabase.from('recordings').select('id', { count: 'exact', head: true }).gte('recorded_at', start.toISOString()).lt('recorded_at', end.toISOString()),
    v.supabase.from('block_outcomes').select('outcome, calendar_blocks!inner(start_at)').eq('outcome', 'kept')
      .gte('calendar_blocks.start_at', start.toISOString()).lt('calendar_blocks.start_at', end.toISOString()),
  ])
  return {
    sessions: (s.data ?? []).map((x) => ({
      mode: x.mode, outcome: x.outcome ?? 'abandoned', isClean: !!x.is_clean, distractions: x.distractions.length,
      activeMinutes: Math.round((x.active_seconds ?? 0) / 60), goalMet: x.goal_met,
    })),
    closedDays: d.count ?? 0,
    recordings: r.count ?? 0,
    keptBlocks: (o.data ?? []).length,
  }
}

export interface MissionView {
  id: string; kind: 'main' | 'side'; skill: SkillId; title: string; target: number; progress: number
  resultBefore: number | null; resultAfter: number | null; done: boolean; trainer: string; unit: string
}

export const loadMissions = cache(async (weekKey: string): Promise<MissionView[]> => {
  const v = await getViewer()
  const { data } = await v.supabase.from('missions').select('*').eq('week_start', weekKey).order('kind')
  if (!data?.length) return []
  // Past weeks keep their stored final progress; the current week is live.
  const live = weekKey >= weekStart(v.today) || data.some((m) => m.progress === null)
  const activity = live ? await loadWeekActivity(v, weekKey) : null
  return data.map((m) => {
    const skill = m.skill as SkillId
    const progress = activity ? missionProgress(skill, activity) : m.progress ?? 0
    return {
      id: m.id, kind: m.kind as 'main' | 'side', skill, title: m.title, target: m.target, progress,
      resultBefore: m.result_before === null ? null : Number(m.result_before),
      resultAfter: m.result_after === null ? null : Number(m.result_after),
      done: progress >= m.target, trainer: MISSIONS[skill].trainer, unit: MISSIONS[skill].unit,
    }
  })
})

/** Current week's main drill (biases suggestions, DESIGN §5.3). */
export const loadCurrentDrill = cache(async (): Promise<SkillId | null> => {
  const v = await getViewer()
  const { data } = await v.supabase.from('missions').select('skill').eq('week_start', weekStart(v.today)).eq('kind', 'main').maybeSingle()
  return (data?.skill as SkillId | undefined) ?? null
})

/** Detect broken personal records from recent data. Returns records not yet celebrated. */
export async function syncRecords(v: Viewer) {
  const since = new Date(v.now.getTime() - 35 * DAY).toISOString()
  const tz = v.profile.timezone
  const [{ data: existing }, { data: sessions }, { data: recs }, { data: blocks }] = await Promise.all([
    v.supabase.from('personal_records').select('record_type, value, previous_value, achieved_at, seen_at'),
    v.supabase.from('sessions').select('id, started_at, active_seconds, is_clean').gte('started_at', since).not('ended_at', 'is', null),
    v.supabase.from('recordings').select('id, recorded_at, fillers_per_min, duration_seconds').gte('recorded_at', since).not('fillers_per_min', 'is', null).gte('duration_seconds', 30),
    v.supabase.from('block_outcomes').select('score, calendar_blocks!inner(start_at)').gte('calendar_blocks.start_at', since),
  ])
  const cands: RecordCandidate[] = []
  const byDay = new Map<string, number>()
  for (const s of sessions ?? []) {
    const min = Math.round((s.active_seconds ?? 0) / 60)
    if (s.is_clean && min >= 10) cands.push({ type: 'longest_clean_session', value: min, at: new Date(s.started_at), refId: s.id })
    const k = dayKey(new Date(s.started_at), tz, v.profile.day_boundary_hour)
    byDay.set(k, (byDay.get(k) ?? 0) + min)
  }
  for (const [k, min] of byDay) if (k < v.today && min >= 30) cands.push({ type: 'most_focus_day', value: min, at: dayRange(k, tz, v.profile.day_boundary_hour).end, refId: null })
  for (const r of recs ?? []) cands.push({ type: 'lowest_filler_rate', value: Number(r.fillers_per_min), at: new Date(r.recorded_at), refId: r.id })
  const weeks = new Map<string, number[]>()
  for (const b of blocks ?? []) {
    if (b.score === null) continue
    const wk = weekStart(localDayMinute(new Date(b.calendar_blocks.start_at), tz).key)
    weeks.set(wk, [...(weeks.get(wk) ?? []), Number(b.score)])
  }
  const thisWeek = weekStart(v.today)
  for (const [wk, scores] of weeks) {
    if (wk >= thisWeek || scores.length < 5) continue
    cands.push({ type: 'best_kept_week', value: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100), at: new Date(`${addDays(wk, 7)}T00:00:00Z`), refId: null })
  }

  const map = new Map((existing ?? []).map((e) => [e.record_type as RecordType, Number(e.value)]))
  const updates = detectRecords(cands, map)
  if (updates.length) {
    await v.supabase.from('personal_records').upsert(updates.map((u) => ({
      owner_id: v.userId, record_type: u.type, value: u.value, previous_value: u.previous, achieved_at: u.at.toISOString(),
      ref_id: u.refId, seen_at: u.celebrate ? null : v.now.toISOString(),
    })), { onConflict: 'owner_id,record_type' })
  }
  const unseen = (existing ?? []).filter((e) => !e.seen_at && !updates.some((u) => u.type === e.record_type))
    .map((e) => ({ type: e.record_type as RecordType, value: Number(e.value), previous: e.previous_value === null ? null : Number(e.previous_value) }))
  return [...unseen, ...updates.filter((u) => u.celebrate).map((u) => ({ type: u.type, value: u.value, previous: u.previous }))]
}

export const loadRecords = cache(async () => {
  const v = await getViewer()
  const { data } = await v.supabase.from('personal_records').select('record_type, value, previous_value, achieved_at').order('achieved_at', { ascending: false })
  return (data ?? []).map((r) => ({ type: r.record_type as RecordType, value: Number(r.value), previous: r.previous_value === null ? null : Number(r.previous_value), achievedAt: r.achieved_at }))
})

export interface GoalWeeks {
  id: string; title: string; status: string; weeklyMinutes: number
  /** `complete` = the week has ended; only complete weeks may resolve forecasts or drive suggestions. */
  weeks: (GoalWeek & { week: string; confidence: number | null; complete: boolean })[]
}

/**
 * Committed vs actual per goal for the last `n` completed weeks (plus the frozen weekly commitment when it exists).
 * Actual = focus minutes from sessions in goal blocks or in the goal's linked projects.
 */
export const loadGoalWeeks = cache(async (n: number, untilWeek: string): Promise<GoalWeeks[]> => {
  const v = await getViewer()
  const firstWeek = addDays(untilWeek, -7 * n)
  const from = weekRange(v, firstWeek).start
  const to = weekRange(v, addDays(untilWeek, -7)).end
  const [{ data: goals }, { data: links }, { data: commits }, { data: conf }, { data: sessions }] = await Promise.all([
    v.supabase.from('goals').select('id, title, status, weekly_commitment_minutes, activated_at').in('status', ['active', 'paused', 'done']).not('activated_at', 'is', null),
    v.supabase.from('goal_projects').select('goal_id, project_id'),
    v.supabase.from('commitments').select('goal_id, week_start, committed_minutes').eq('level', 'week_goal').gte('week_start', firstWeek),
    v.supabase.from('goal_confidence').select('goal_id, week_start, confidence_pct').gte('week_start', firstWeek),
    v.supabase.from('sessions').select('started_at, active_seconds, tasks(project_id), calendar_blocks(goal_id)')
      .gte('started_at', from.toISOString()).lt('started_at', to.toISOString()).not('ended_at', 'is', null),
  ])
  return (goals ?? []).map((g) => {
    const projects = new Set((links ?? []).filter((l) => l.goal_id === g.id).map((l) => l.project_id))
    const weeks: GoalWeeks['weeks'] = []
    for (let i = 0; i < n; i++) {
      const wk = addDays(firstWeek, 7 * i)
      const r = weekRange(v, wk)
      if (r.end.toISOString() <= g.activated_at!) continue
      const actual = Math.round((sessions ?? []).filter((s) => s.started_at >= r.start.toISOString() && s.started_at < r.end.toISOString() &&
        (s.calendar_blocks?.goal_id === g.id || (!!s.tasks?.project_id && projects.has(s.tasks.project_id))))
        .reduce((a, s) => a + (s.active_seconds ?? 0), 0) / 60)
      const c = (commits ?? []).find((x) => x.goal_id === g.id && x.week_start === wk)
      const f = (conf ?? []).find((x) => x.goal_id === g.id && x.week_start === wk)
      weeks.push({ week: wk, committed: c?.committed_minutes ?? g.weekly_commitment_minutes, actual, confidence: f?.confidence_pct ?? null, complete: r.end <= v.now })
    }
    return { id: g.id, title: g.title, status: g.status, weeklyMinutes: g.weekly_commitment_minutes, weeks }
  })
})

/** Rule-based insight cards from the last 4 weeks (DESIGN §5.4). */
export const loadInsights = cache(async () => {
  const v = await getViewer()
  const tz = v.profile.timezone
  const since = new Date(v.now.getTime() - 28 * DAY).toISOString()
  const [doneRes, sessRes, dayRes, blockRes, startRes, recRes, goalWeeks] = await Promise.all([
    v.supabase.from('tasks').select('id, estimate_minutes, projects(name)').eq('status', 'done').not('estimate_minutes', 'is', null).gte('completed_at', since),
    v.supabase.from('sessions').select('started_at, active_seconds, planned_minutes, mode, outcome, is_clean, distractions(kind, at)').gte('started_at', since).not('ended_at', 'is', null),
    v.supabase.from('day_plans').select('day, energy').gte('day', addDays(v.today, -29)).not('energy', 'is', null),
    v.supabase.from('block_outcomes').select('outcome, score, calendar_blocks!inner(start_at)').gte('calendar_blocks.start_at', since),
    v.supabase.from('tasks').select('first_planned_at, first_started_at, if_then_trigger').not('first_planned_at', 'is', null).gte('first_planned_at', since),
    v.supabase.from('recordings').select('id, take_number, fillers_per_min, filler_breakdown, parent_recording_id').gte('recorded_at', since),
    loadGoalWeeks(4, weekStart(v.today)),
  ])
  const done = doneRes.data ?? []
  const secs = await actualSecondsByTask(v.supabase, done.map((d) => d.id))
  const actualBy = new Map([...secs].map(([id, s]) => [id, s / 60]))
  const energyBy = new Map((dayRes.data ?? []).map((d) => [d.day, d.energy]))
  const recs = recRes.data ?? []
  const fillersById = new Map(recs.map((r) => [r.id, r.fillers_per_min === null ? null : Number(r.fillers_per_min)]))

  const data: InsightData = {
    estimates: done.filter((d) => (actualBy.get(d.id) ?? 0) >= 1).map((d) => ({ project: d.projects?.name ?? null, ratio: actualBy.get(d.id)! / d.estimate_minutes! })),
    sessions: (sessRes.data ?? []).map((s) => ({
      localHour: Math.floor(localDayMinute(new Date(s.started_at), tz).minute / 60),
      activeMinutes: (s.active_seconds ?? 0) / 60,
      distractions: s.distractions.map((d) => ({ kind: d.kind as 'internal' | 'external', localHour: Math.floor(localDayMinute(new Date(d.at), tz).minute / 60) })),
      plannedMinutes: s.planned_minutes, mode: s.mode, outcome: s.outcome ?? 'abandoned', isClean: !!s.is_clean,
      dayEnergy: energyBy.get(dayKey(new Date(s.started_at), tz, v.profile.day_boundary_hour)) ?? null,
    })),
    blocks: [],
    goals: goalWeeks.map((g) => ({ ...g, weeks: g.weeks.filter((w) => w.complete) })).filter((g) => g.weeks.length >= 2).map((g) => ({
      id: g.id, title: g.title, weeks: g.weeks.length,
      committed: g.weeks.reduce((a, w) => a + w.committed, 0), actual: g.weeks.reduce((a, w) => a + w.actual, 0),
    })),
    forecasts: goalWeeks.flatMap((g) => g.weeks.filter((w) => w.complete && w.confidence !== null).map((w) => ({ p: w.confidence! / 100, hit: deliveredWeek(w) }))),
    starts: (startRes.data ?? []).map((t) => ({
      hasCue: !!t.if_then_trigger,
      latencyDays: ((t.first_started_at ? new Date(t.first_started_at) : v.now).getTime() - new Date(t.first_planned_at!).getTime()) / DAY,
    })),
    recordings: recs.map((r) => ({
      fillerBreakdown: (r.filler_breakdown ?? {}) as Record<string, number>, take: r.take_number,
      fillersPerMin: r.fillers_per_min === null ? null : Number(r.fillers_per_min),
      parentFillersPerMin: r.parent_recording_id ? fillersById.get(r.parent_recording_id) ?? null : null,
    })),
  }

  // A moved block's outcome is 'moved' with score 0.75 × its base (kept → 0.75).
  data.blocks = (blockRes.data ?? []).map((b) => ({
    localHour: Math.floor(localDayMinute(new Date(b.calendar_blocks.start_at), tz).minute / 60),
    outcome: b.outcome, score: b.score === null ? null : Number(b.score), moved: b.outcome === 'moved',
  }))
  return computeInsights(data)
})

export interface AgingTask {
  id: string; title: string; firstAction: string | null; status: string; estimate: number | null
  energy: 'deep' | 'shallow' | 'admin' | null; projectId: string | null; projectName: string | null; projectColor: string | null
  ageDays: number; deferrals: number
}

/** Tasks untouched for `aging_days` (DESIGN F20), oldest first. */
export const loadAging = cache(async (): Promise<AgingTask[]> => {
  const v = await getViewer()
  const cutoff = new Date(v.now.getTime() - v.settings.aging_days * DAY).toISOString()
  const { data } = await v.supabase.from('tasks')
    .select('id, title, first_action, status, estimate_minutes, energy, project_id, deferral_count, last_touched_at, projects(name, color)')
    .in('status', ['inbox', 'backlog', 'today', 'evening']).lte('last_touched_at', cutoff)
    .or(`hidden_until.is.null,hidden_until.lte.${v.today}`).order('last_touched_at').limit(50)
  return (data ?? []).map((t) => ({
    id: t.id, title: t.title, firstAction: t.first_action, status: t.status, estimate: t.estimate_minutes,
    energy: t.energy as AgingTask['energy'], projectId: t.project_id, projectName: t.projects?.name ?? null, projectColor: t.projects?.color ?? null,
    ageDays: Math.floor((v.now.getTime() - new Date(t.last_touched_at).getTime()) / DAY), deferrals: t.deferral_count,
  }))
})

export const loadKilled = cache(async () => {
  const v = await getViewer()
  const { data } = await v.supabase.from('tasks').select('id, title, killed_at, projects(name, color)').eq('status', 'killed')
    .order('killed_at', { ascending: false, nullsFirst: false }).limit(100)
  return (data ?? []).map((t) => ({ id: t.id, title: t.title, killedAt: t.killed_at, projectName: t.projects?.name ?? null, projectColor: t.projects?.color ?? null }))
})

export interface HabitView { id: string; name: string; weekdays: number[]; active: boolean; grid: ReturnType<typeof habitGrid>; doneToday: boolean; dueToday: boolean }

export const loadHabits = cache(async (windowDays = 30): Promise<HabitView[]> => {
  const v = await getViewer()
  const from = addDays(v.today, -(windowDays - 1))
  const [{ data: habits }, { data: logs }] = await Promise.all([
    v.supabase.from('habits').select('id, name, weekdays, active, created_at').order('created_at'),
    v.supabase.from('habit_logs').select('habit_id, day').gte('day', from),
  ])
  const dow = dayOfWeek(v.today)
  return (habits ?? []).map((h) => {
    const done = new Set((logs ?? []).filter((l) => l.habit_id === h.id).map((l) => l.day))
    const grid = habitGrid({
      today: v.today, windowDays, weekdays: h.weekdays, doneDays: done,
      createdDay: dayKey(new Date(h.created_at), v.profile.timezone, v.profile.day_boundary_hour),
    })
    return { id: h.id, name: h.name, weekdays: h.weekdays, active: h.active, grid, doneToday: done.has(v.today), dueToday: h.weekdays.includes(dow) }
  })
})
