import 'server-only'
import { cache } from 'react'
import { getViewer } from './viewer'
import { goalPace, type GoalType, type Pace } from '@/domain/goals/pace'
import { addDays, dayRange, weekStart } from '@/domain/time/day'
import { fetchAll } from '@/lib/supabase/paging'

export interface GoalView {
  id: string
  title: string
  type: GoalType
  targetText: string
  targetValue: number | null
  currentValue: number
  targetUnit: string | null
  deadline: string | null
  weeklyMinutes: number
  why: string | null
  obstacle: string | null
  ifThen: string | null
  status: string
  activatedAt: string | null
  projectIds: string[]
  milestones: { id: string; title: string; dueDate: string | null; done: boolean }[]
  spentMinutes: number
  weekSpentMinutes: number
  weekPlannedMinutes: number
  pace: Pace
}

/** Goals with attributed time (via linked projects or goal blocks) and pace (DESIGN §9.2). */
export const loadGoals = cache(async (): Promise<GoalView[]> => {
  const v = await getViewer()
  const { supabase, now, today, profile } = v
  const [{ data: goals }, { data: links }, { data: ms }] = await Promise.all([
    supabase.from('goals').select('*').neq('status', 'dropped').order('created_at'),
    supabase.from('goal_projects').select('goal_id, project_id'),
    supabase.from('milestones').select('id, goal_id, title, due_date, done_at, sort_order').order('sort_order'),
  ])
  if (!goals?.length) return []
  const earliest = goals.reduce((a, g) => (g.activated_at && g.activated_at < a ? g.activated_at : a), now.toISOString())
  const ws = weekStart(today)
  const wsStart = dayRange(ws, profile.timezone, profile.day_boundary_hour).start
  const wsEnd = dayRange(addDays(ws, 6), profile.timezone, profile.day_boundary_hour).end

  const [sessions, { data: weekBlocks }] = await Promise.all([
    // All sessions since the earliest activation can exceed one response page.
    fetchAll((a, b) => supabase.from('sessions').select('id, started_at, active_seconds, tasks(project_id), calendar_blocks(goal_id)')
      .gte('started_at', earliest).not('ended_at', 'is', null).order('started_at').order('id').range(a, b)),
    supabase.from('calendar_blocks').select('goal_id, start_at, end_at').not('goal_id', 'is', null).neq('status', 'cancelled')
      .gte('start_at', wsStart.toISOString()).lt('start_at', wsEnd.toISOString()),
  ])

  return goals.map((g) => {
    const projectIds = (links ?? []).filter((l) => l.goal_id === g.id).map((l) => l.project_id)
    const mine = sessions.filter((s) =>
      (g.activated_at ? s.started_at >= g.activated_at : true) &&
      (s.calendar_blocks?.goal_id === g.id || (!!s.tasks?.project_id && projectIds.includes(s.tasks.project_id))))
    const spent = Math.round(mine.reduce((a, s) => a + (s.active_seconds ?? 0), 0) / 60)
    const weekSpent = Math.round(mine.filter((s) => s.started_at >= wsStart.toISOString()).reduce((a, s) => a + (s.active_seconds ?? 0), 0) / 60)
    const weekPlanned = Math.round((weekBlocks ?? []).filter((b) => b.goal_id === g.id)
      .reduce((a, b) => a + (new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60_000, 0))
    const pace = goalPace({
      type: g.type as GoalType, targetValue: g.target_value, currentValue: Number(g.current_value),
      deadline: g.deadline ? new Date(g.deadline) : null, activatedAt: g.activated_at ? new Date(g.activated_at) : null,
      weeklyCommitmentMinutes: g.weekly_commitment_minutes, spentMinutes: spent,
      progressHistory: g.activated_at ? [{ at: new Date(g.activated_at), value: 0 }] : [],
      now,
    })
    return {
      id: g.id, title: g.title, type: g.type as GoalType, targetText: g.target_text, targetValue: g.target_value,
      currentValue: Number(g.current_value), targetUnit: g.target_unit, deadline: g.deadline,
      weeklyMinutes: g.weekly_commitment_minutes, why: g.why_text, obstacle: g.woop_obstacle, ifThen: g.woop_if_then,
      status: g.status, activatedAt: g.activated_at, projectIds,
      milestones: (ms ?? []).filter((m) => m.goal_id === g.id).map((m) => ({ id: m.id, title: m.title, dueDate: m.due_date, done: !!m.done_at })),
      spentMinutes: spent, weekSpentMinutes: weekSpent, weekPlannedMinutes: weekPlanned, pace,
    }
  })
})
