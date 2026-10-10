'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getViewer } from '@/lib/data/viewer'
import type { Result } from './tasks'

const ACTIVE_GOAL_CAP = 5
const done = (): Result => {
  revalidatePath('/', 'layout')
  return { ok: true }
}

const goalSchema = z.object({
  title: z.string().trim().min(1, 'Name the goal.').max(120),
  type: z.enum(['outcome', 'learning', 'process']),
  targetText: z.string().trim().min(1, 'Define what “done” means.').max(200),
  targetValue: z.number().positive().nullable(),
  targetUnit: z.string().trim().max(30).nullable(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  weeklyHours: z.number().min(0).max(100),
  why: z.string().trim().max(300).nullable(),
  obstacle: z.string().trim().min(3, 'Name your biggest inner obstacle.').max(300),
  ifThen: z.string().trim().min(3, 'Write your if-then plan.').max(300),
  projectIds: z.array(z.string().uuid()).max(10),
  milestones: z.array(z.object({ title: z.string().trim().min(1).max(120), dueDate: z.string().nullable() })).max(6),
  activate: z.boolean(),
})

/** Create a goal through the WOOP flow (DESIGN §9.2). Activation requires obstacle + if-then and respects the cap. */
export async function createGoal(input: z.input<typeof goalSchema>): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const p = goalSchema.safeParse(input)
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Invalid goal.' }
  const d = p.data
  if (d.type !== 'process' && !d.deadline) return { ok: false, error: 'Outcome and learning goals need a deadline.' }
  const { supabase, now } = await getViewer()
  let activate = d.activate
  if (activate) {
    const { count } = await supabase.from('goals').select('id', { count: 'exact', head: true }).eq('status', 'active')
    if ((count ?? 0) >= ACTIVE_GOAL_CAP) activate = false
  }
  const { data: goal, error } = await supabase.from('goals').insert({
    title: d.title, type: d.type, target_text: d.targetText, target_value: d.targetValue, target_unit: d.targetUnit,
    deadline: d.type === 'process' ? null : d.deadline, weekly_commitment_minutes: Math.round(d.weeklyHours * 60),
    why_text: d.why, woop_obstacle: d.obstacle, woop_if_then: d.ifThen,
    status: activate ? 'active' : 'draft', activated_at: activate ? now.toISOString() : null,
  }).select('id').single()
  if (error || !goal) return { ok: false, error: 'Could not save the goal.' }
  await Promise.all([
    d.projectIds.length ? supabase.from('goal_projects').insert(d.projectIds.map((project_id) => ({ goal_id: goal.id, project_id }))) : null,
    d.milestones.length ? supabase.from('milestones').insert(d.milestones.map((m, i) => ({ goal_id: goal.id, title: m.title, due_date: m.dueDate || null, sort_order: i }))) : null,
  ])
  revalidatePath('/', 'layout')
  if (d.activate && !activate) return { ok: false, error: `Saved as a draft — ${ACTIVE_GOAL_CAP} goals are already active. Pause one to activate it.` }
  return { ok: true, id: goal.id }
}

export async function setGoalStatus(id: string, status: 'active' | 'paused' | 'done' | 'dropped'): Promise<Result> {
  const p = z.object({ id: z.string().uuid(), status: z.enum(['active', 'paused', 'done', 'dropped']) }).safeParse({ id, status })
  if (!p.success) return { ok: false, error: 'Invalid request.' }
  const { supabase, now } = await getViewer()
  if (status === 'active') {
    const { count } = await supabase.from('goals').select('id', { count: 'exact', head: true }).eq('status', 'active').neq('id', id)
    if ((count ?? 0) >= ACTIVE_GOAL_CAP) return { ok: false, error: `${ACTIVE_GOAL_CAP} goals are already active. Pause one first.` }
  }
  const { data: g } = await supabase.from('goals').select('activated_at').eq('id', id).single()
  const { error } = await supabase.from('goals').update({
    status,
    ...(status === 'active' && !g?.activated_at && { activated_at: now.toISOString() }),
    ...((status === 'done' || status === 'dropped') && { resolved_at: now.toISOString() }),
  }).eq('id', id)
  if (error?.code === '23514') return { ok: false, error: 'Add an obstacle and if-then plan before activating.' }
  if (error) return { ok: false, error: 'Could not update the goal.' }
  return done()
}

export async function updateGoalProgress(id: string, currentValue: number): Promise<Result> {
  const p = z.object({ id: z.string().uuid(), v: z.number().min(0).max(1e9) }).safeParse({ id, v: currentValue })
  if (!p.success) return { ok: false, error: 'Invalid value.' }
  const { supabase } = await getViewer()
  const { error } = await supabase.from('goals').update({ current_value: p.data.v }).eq('id', id)
  return error ? { ok: false, error: 'Could not save progress.' } : done()
}

export async function setWeeklyCommitment(id: string, hours: number): Promise<Result> {
  const p = z.object({ id: z.string().uuid(), h: z.number().min(0).max(100) }).safeParse({ id, h: hours })
  if (!p.success) return { ok: false, error: 'Invalid hours.' }
  const { supabase } = await getViewer()
  const { error } = await supabase.from('goals').update({ weekly_commitment_minutes: Math.round(p.data.h * 60) }).eq('id', id)
  return error ? { ok: false, error: 'Could not save.' } : done()
}

export async function toggleMilestone(id: string, isDone: boolean): Promise<Result> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'Invalid request.' }
  const { supabase, now } = await getViewer()
  const { error } = await supabase.from('milestones').update({ done_at: isDone ? now.toISOString() : null }).eq('id', id)
  return error ? { ok: false, error: 'Could not update.' } : done()
}
