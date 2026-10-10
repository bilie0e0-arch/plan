'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getViewer } from '@/lib/data/viewer'
import { addDays, dayRange } from '@/domain/time/day'
import { ifThenLine, RELEASE_LEAD_MS } from '@/domain/calendar/blocks'
import type { Result } from './tasks'

const MIN = 60_000
const TYPES = ['focus', 'speaking', 'ritual', 'buffer', 'recovery'] as const
const MODES = ['ladder', 'blind', 'starter', 'timebox', 'free'] as const
const done = (): Result => {
  revalidatePath('/', 'layout')
  return { ok: true }
}

const blockSchema = z.object({
  type: z.enum(TYPES),
  title: z.string().trim().min(1).max(200),
  start: z.string().datetime(),
  minutes: z.number().int().min(5).max(600),
  taskId: z.string().uuid().nullable(),
  goalId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable().default(null),
  timerMode: z.enum(MODES).nullable(),
  commit: z.boolean(),
  repeatWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
})

/** Create a block (or a weekly recurring series). Committing freezes a snapshot (DESIGN §9.4). */
export async function createBlock(input: z.input<typeof blockSchema>): Promise<Result> {
  const p = blockSchema.safeParse(input)
  if (!p.success) return { ok: false, error: 'Check the block details.' }
  const d = p.data
  const { supabase, profile, now } = await getViewer()
  const start = new Date(d.start)
  const end = new Date(start.getTime() + d.minutes * MIN)
  if (start.getTime() < now.getTime() - 5 * MIN) return { ok: false, error: 'That time has already passed.' }

  let firstStep = d.title
  if (d.taskId) {
    const { data: t } = await supabase.from('tasks').select('first_action, title').eq('id', d.taskId).single()
    firstStep = t?.first_action || t?.title || d.title
  }
  const ifThen = ifThenLine(start, profile.timezone, firstStep)

  let seriesId: string | null = null
  if (d.repeatWeekdays.length) {
    const local = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: profile.timezone }).format(start)
    const [hh, mm] = local.split(':').map(Number) as [number, number]
    const { data: s, error } = await supabase.from('block_series').insert({
      type: d.type, title: d.title, task_id: d.taskId, goal_id: d.goalId, project_id: d.projectId, weekdays: d.repeatWeekdays,
      start_minute: hh * 60 + mm, duration_minutes: d.minutes, timer_mode: d.timerMode,
    }).select('id').single()
    if (error || !s) return { ok: false, error: 'Could not create the recurring block.' }
    seriesId = s.id
  }

  const { data: block, error } = await supabase.from('calendar_blocks').insert({
    type: d.type, title: d.title, task_id: d.taskId, goal_id: d.goalId, project_id: d.projectId, series_id: seriesId,
    start_at: start.toISOString(), end_at: end.toISOString(), timer_mode: d.timerMode, if_then_text: ifThen,
    status: d.commit && d.type !== 'buffer' ? 'committed' : 'planned',
  }).select('id').single()
  if (error || !block) return { ok: false, error: error?.code === '23505' ? 'A block already exists at that time.' : 'Could not create the block.' }
  // Scheduling a task is a decision about it: it leaves the aging queue.
  if (d.taskId) await supabase.from('tasks').update({ last_touched_at: now.toISOString() }).eq('id', d.taskId)
  if (d.commit && d.type !== 'buffer') {
    await supabase.from('commitments').insert({
      level: 'block', block_id: block.id, committed_start: start.toISOString(), committed_minutes: d.minutes,
      goal_id: d.goalId, snapshot: { title: d.title, type: d.type },
    })
  }
  return done()
}

/** Move or resize. Committed blocks keep their frozen original; the change becomes a revision. */
export async function updateBlock(input: { id: string; start: string; minutes: number; title?: string; projectId?: string | null }): Promise<Result> {
  const p = z.object({
    id: z.string().uuid(), start: z.string().datetime(), minutes: z.number().int().min(5).max(600),
    title: z.string().trim().min(1).max(200).optional(), projectId: z.string().uuid().nullable().optional(),
  }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Invalid change.' }
  const { supabase, profile, now } = await getViewer()
  const { data: b } = await supabase.from('calendar_blocks').select('id, start_at, end_at, status, type, title, if_then_text').eq('id', p.data.id).single()
  if (new Date(p.data.start).getTime() !== new Date(b?.start_at ?? 0).getTime() && new Date(p.data.start).getTime() < now.getTime() - 5 * MIN) {
    return { ok: false, error: 'Pick a time that hasn’t passed yet.' }
  }
  if (!b || b.type === 'fixed') return { ok: false, error: 'This block can’t be edited here.' }
  const newStart = new Date(p.data.start)
  const oldMinutes = Math.round((new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / MIN)
  const moved = newStart.getTime() !== new Date(b.start_at).getTime()
  const resized = p.data.minutes !== oldMinutes
  const firstStep = b.if_then_text?.split('→')[1]?.trim() || b.title

  const { error } = await supabase.from('calendar_blocks').update({
    start_at: newStart.toISOString(), end_at: new Date(newStart.getTime() + p.data.minutes * MIN).toISOString(),
    if_then_text: ifThenLine(newStart, profile.timezone, firstStep), ...(p.data.title && { title: p.data.title }),
    ...(p.data.projectId !== undefined && { project_id: p.data.projectId }),
  }).eq('id', b.id)
  if (error) return { ok: false, error: 'Could not update the block.' }

  if (b.status === 'committed' && (moved || resized)) {
    const { data: c } = await supabase.from('commitments').select('id').eq('block_id', b.id).maybeSingle()
    if (c) {
      const rows = []
      if (moved) rows.push({ commitment_id: c.id, change: 'moved', new_start: newStart.toISOString() })
      if (resized) rows.push({ commitment_id: c.id, change: p.data.minutes < oldMinutes ? 'shortened' : 'extended', new_minutes: p.data.minutes })
      await supabase.from('commitment_revisions').insert(rows)
    }
  }
  return done()
}

/**
 * Cancel a block. For committed blocks: ≥ 2 h ahead with a reason = Released (not a failure);
 * later or without a reason counts as Missed (DESIGN §9.4).
 */
export async function cancelBlock(input: { id: string; reason: string | null; deleteSeries?: boolean }): Promise<Result & { released?: boolean }> {
  const p = z.object({ id: z.string().uuid(), reason: z.string().trim().max(200).nullable(), deleteSeries: z.boolean().optional() }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Invalid request.' }
  const { supabase, now } = await getViewer()
  const { data: b } = await supabase.from('calendar_blocks').select('id, status, start_at, series_id').eq('id', p.data.id).single()
  if (!b) return { ok: false, error: 'Block not found.' }
  if (p.data.deleteSeries && b.series_id) await supabase.from('block_series').update({ active: false }).eq('id', b.series_id)

  if (b.status !== 'committed') {
    const { error } = await supabase.from('calendar_blocks').delete().eq('id', b.id)
    if (error) return { ok: false, error: 'Could not remove the block.' }
    return done()
  }
  const released = new Date(b.start_at).getTime() - now.getTime() >= RELEASE_LEAD_MS && !!p.data.reason
  await supabase.from('calendar_blocks').update({ status: 'cancelled', cancelled_at: now.toISOString(), cancel_reason: p.data.reason }).eq('id', b.id)
  const { data: c } = await supabase.from('commitments').select('id').eq('block_id', b.id).maybeSingle()
  if (c) await supabase.from('commitment_revisions').insert({ commitment_id: c.id, change: released ? 'released' : 'cancelled_late', reason: p.data.reason })
  revalidatePath('/', 'layout')
  return { ok: true, released }
}

/** Commit week (DESIGN F75): freezes every planned block in the week plus each goal's weekly hours. */
export async function commitWeek(weekKey: string): Promise<Result> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekKey)) return { ok: false, error: 'Invalid week.' }
  const { supabase, profile } = await getViewer()
  const from = dayRange(weekKey, profile.timezone, 0).start
  const to = dayRange(addDays(weekKey, 6), profile.timezone, 0).end
  const { data: blocks } = await supabase.from('calendar_blocks').select('id, title, type, goal_id, start_at, end_at')
    .eq('status', 'planned').in('type', [...TYPES].filter((t) => t !== 'buffer'))
    .gte('start_at', new Date(Math.max(from.getTime(), Date.now())).toISOString()).lt('start_at', to.toISOString())
  const list = blocks ?? []
  if (list.length) {
    await supabase.from('calendar_blocks').update({ status: 'committed' }).in('id', list.map((b) => b.id))
    await supabase.from('commitments').upsert(list.map((b) => ({
      level: 'block', block_id: b.id, goal_id: b.goal_id, committed_start: b.start_at,
      committed_minutes: Math.round((new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / MIN),
      snapshot: { title: b.title, type: b.type },
    })), { onConflict: 'block_id', ignoreDuplicates: true })
  }
  const { data: goals } = await supabase.from('goals').select('id, weekly_commitment_minutes, title').eq('status', 'active')
  if (goals?.length) {
    await supabase.from('commitments').upsert(goals.map((g) => ({
      level: 'week_goal', goal_id: g.id, week_start: weekKey, committed_minutes: g.weekly_commitment_minutes, snapshot: { title: g.title },
    })), { onConflict: 'owner_id,level,goal_id,week_start', ignoreDuplicates: true })
  }
  return done()
}

export async function commitBlock(id: string): Promise<Result> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'Invalid request.' }
  const { supabase } = await getViewer()
  const { data: b } = await supabase.from('calendar_blocks').select('id, title, type, goal_id, start_at, end_at, status').eq('id', id).single()
  if (!b || b.status !== 'planned' || b.type === 'fixed' || b.type === 'buffer') return { ok: false, error: 'This block can’t be committed.' }
  await supabase.from('calendar_blocks').update({ status: 'committed' }).eq('id', id)
  await supabase.from('commitments').insert({
    level: 'block', block_id: id, goal_id: b.goal_id, committed_start: b.start_at,
    committed_minutes: Math.round((new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / MIN), snapshot: { title: b.title, type: b.type },
  })
  return done()
}
