'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getViewer } from '@/lib/data/viewer'
import { loadToday } from '@/lib/data/today'
import { addDays } from '@/domain/time/day'
import type { Result } from './tasks'

const ok = (): Result => {
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Morning check-in (DESIGN F56): energy 1–5 and optional sleep. */
export async function saveCheckin(input: { energy: number; sleepHours: number | null }): Promise<Result> {
  const p = z.object({ energy: z.number().int().min(1).max(5), sleepHours: z.number().min(0).max(24).nullable() }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Invalid check-in.' }
  const { supabase, userId, today } = await getViewer()
  const { error } = await supabase.from('day_plans').upsert(
    { owner_id: userId, day: today, energy: p.data.energy, sleep_hours: p.data.sleepHours },
    { onConflict: 'owner_id,day' },
  )
  if (error) return { ok: false, error: 'Could not save the check-in.' }
  return ok()
}

/** Confirm the plan: freezes planned minutes and the multiplier used (DESIGN F6, F8). */
export async function startDay(input: { availableMinutes: number }): Promise<Result> {
  const p = z.object({ availableMinutes: z.number().int().min(0).max(1440) }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Enter your available time.' }
  const { supabase, userId, today, now } = await getViewer()
  const t = await loadToday()
  const planned = [...t.main, ...t.evening].filter((x) => !x.leftover)
  const estimated = planned.filter((x) => x.estimate)
  const multiplier = estimated.length ? estimated.reduce((a, x) => a + x.multiplier, 0) / estimated.length : 1
  const { error } = await supabase.from('day_plans').upsert({
    owner_id: userId,
    day: today,
    available_minutes: p.data.availableMinutes,
    planned_minutes: t.fit.adjustedMinutes,
    multiplier_used: Math.round(multiplier * 100) / 100,
    planned_task_count: planned.length,
    opened_at: now.toISOString(),
  }, { onConflict: 'owner_id,day' })
  if (error) return { ok: false, error: 'Could not start the day.' }
  return ok()
}

/** Shutdown step 1: resolve a leftover task. */
export async function shutdownMove(input: { id: string; to: 'tomorrow' | 'backlog' | 'done' }): Promise<Result> {
  const p = z.object({ id: z.string().uuid(), to: z.enum(['tomorrow', 'backlog', 'done']) }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Invalid request.' }
  const { supabase, today, now } = await getViewer()
  const { data: task } = await supabase.from('tasks').select('deferral_count').eq('id', p.data.id).single()
  if (!task) return { ok: false, error: 'Task not found.' }
  const patch =
    p.data.to === 'done'
      ? { status: 'done', completed_at: now.toISOString() }
      : p.data.to === 'tomorrow'
        ? { status: 'today', planned_for: addDays(today, 1), deferral_count: task.deferral_count + 1 }
        : { status: 'backlog', planned_for: null, deferral_count: task.deferral_count + 1 }
  const { error } = await supabase.from('tasks').update({ ...patch, last_touched_at: now.toISOString() }).eq('id', p.data.id)
  if (error) return { ok: false, error: 'Could not move the task.' }
  return ok()
}

/** Close the day (DESIGN F12): records completion rate for the Planning skill. */
export async function closeDay(): Promise<Result> {
  const { supabase, userId, today, now } = await getViewer()
  const t = await loadToday()
  const plannedCount = t.plan?.planned_task_count ?? t.done.length + t.main.length + t.evening.length
  const doneCount = t.done.length
  const rate = plannedCount > 0 ? Math.min(1, doneCount / plannedCount) : null
  const { error } = await supabase.from('day_plans').upsert({
    owner_id: userId, day: today, closed_at: now.toISOString(),
    done_task_count: doneCount, completion_rate: rate,
    planned_task_count: plannedCount,
    opened_at: t.plan?.opened_at ?? now.toISOString(),
  }, { onConflict: 'owner_id,day' })
  if (error) return { ok: false, error: 'Could not close the day.' }
  return ok()
}

export async function reopenDay(): Promise<Result> {
  const { supabase, today } = await getViewer()
  const { error } = await supabase.from('day_plans').update({ closed_at: null }).eq('day', today)
  if (error) return { ok: false, error: 'Could not reopen the day.' }
  return ok()
}
