'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getViewer } from '@/lib/data/viewer'
import { parseCapture } from '@/domain/capture/parse-capture'

export type Result = { ok: true } | { ok: false; error: string }

const fail = (error: string): Result => ({ ok: false, error })
const done = (): Result => {
  revalidatePath('/', 'layout')
  return { ok: true }
}

const uuid = z.string().uuid()

export async function captureTask(raw: string, parked = false): Promise<Result> {
  const { supabase, today } = await getViewer()
  const parsed = parseCapture(String(raw ?? '').slice(0, 600), today)
  if (!parsed.title) return fail('Write something to capture.')

  let projectId: string | null = null
  let title = parsed.title
  if (parsed.projectName) {
    const { data: project } = await supabase.from('projects').select('id').eq('name', parsed.projectName).maybeSingle()
    if (project) projectId = project.id
    else title = `${title} #${parsed.projectName}`
  }
  const { error } = await supabase.from('tasks').insert({
    title: title.slice(0, 500),
    project_id: projectId,
    estimate_minutes: parsed.estimateMinutes,
    energy: parsed.energy,
    kind: parsed.kind,
    source: parked ? 'parked' : 'capture',
    // "tomorrow" / "fri": out of sight until that day. "3pm": a time cue card on Home.
    hidden_until: parsed.showOn && parsed.showOn > today ? parsed.showOn : null,
    if_then_minute: parsed.atMinute,
    if_then_trigger: parsed.atMinute !== null ? `Start: ${title}`.slice(0, 200) : null,
  })
  if (error) return fail('Could not save. Please try again.')
  return done()
}

const destinations = ['today', 'evening', 'backlog', 'someday', 'inbox', 'killed'] as const

/** Move a task. Today/Evening enforce the WIP cap; the first small step is suggested, never required (UI v0.6). */
export async function moveTask(input: { id: string; to: (typeof destinations)[number]; firstAction?: string }): Promise<Result> {
  const p = z.object({ id: uuid, to: z.enum(destinations), firstAction: z.string().trim().max(200).optional() }).safeParse(input)
  if (!p.success) return fail('Invalid request.')
  const { supabase, settings, today, now } = await getViewer()
  const { data: task } = await supabase.from('tasks').select('id, status, planned_for, first_action, first_planned_at, deferral_count').eq('id', p.data.id).single()
  if (!task) return fail('Task not found.')
  const nowIso = now.toISOString()

  if (p.data.to === 'today' || p.data.to === 'evening') {
    const firstAction = p.data.firstAction ?? task.first_action ?? ''
    const alreadyIn = task.status === 'today' || task.status === 'evening'
    if (!alreadyIn) {
      const { count } = await supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['today', 'evening'])
      if ((count ?? 0) >= settings.wip_cap) return fail(`Today is full (${settings.wip_cap}). Finish or remove one first.`)
    }
    const leftover = !!task.planned_for && task.planned_for < today
    const { data: last } = await supabase.from('tasks').select('sort_order').in('status', ['today', 'evening']).order('sort_order', { ascending: false }).limit(1).maybeSingle()
    const { error } = await supabase.from('tasks').update({
      status: p.data.to,
      first_action: firstAction.trim() || null,
      planned_for: today,
      first_planned_at: task.first_planned_at ?? nowIso,
      deferral_count: task.deferral_count + (leftover ? 1 : 0),
      sort_order: alreadyIn && !leftover ? undefined : (last?.sort_order ?? 0) + 1,
      last_touched_at: nowIso,
    }).eq('id', task.id)
    if (error) return fail('Could not move the task.')
    return done()
  }

  const wasPlanned = task.status === 'today' || task.status === 'evening'
  const { error } = await supabase.from('tasks').update({
    status: p.data.to,
    planned_for: p.data.to === 'killed' ? task.planned_for : null,
    killed_at: p.data.to === 'killed' ? nowIso : null,
    deferral_count: task.deferral_count + (wasPlanned && p.data.to !== 'killed' ? 1 : 0),
    last_touched_at: nowIso,
  }).eq('id', task.id)
  if (error) return fail('Could not move the task.')
  return done()
}

export async function setTaskDone(id: string, isDone: boolean): Promise<Result> {
  if (!uuid.safeParse(id).success) return fail('Invalid request.')
  const { supabase, now, today } = await getViewer()
  const { error } = await supabase.from('tasks').update(
    isDone
      ? { status: 'done', completed_at: now.toISOString(), last_touched_at: now.toISOString() }
      : { status: 'today', completed_at: null, planned_for: today, last_touched_at: now.toISOString() },
  ).eq('id', id)
  if (error) return fail('Could not update the task.')
  return done()
}

const editSchema = z.object({
  id: uuid,
  title: z.string().trim().min(1).max(500).optional(),
  firstAction: z.string().trim().max(200).nullable().optional(),
  estimate: z.number().int().min(1).max(1440).nullable().optional(),
  energy: z.enum(['deep', 'shallow', 'admin']).nullable().optional(),
  projectId: uuid.nullable().optional(),
  doneWhen: z.string().trim().max(200).nullable().optional(),
  ifThenTrigger: z.string().trim().max(200).nullable().optional(),
  ifThenMinute: z.number().int().min(0).max(1439).nullable().optional(),
})

export async function editTask(input: z.input<typeof editSchema>): Promise<Result> {
  const p = editSchema.safeParse(input)
  if (!p.success) return fail('Check the values and try again.')
  const { supabase, now } = await getViewer()
  const { id, title, firstAction, estimate, energy, projectId, doneWhen, ifThenTrigger, ifThenMinute } = p.data
  if (ifThenMinute != null && !ifThenTrigger) return fail('Add the if-then line for the cue time.')
  const { error } = await supabase.from('tasks').update({
    ...(title !== undefined && { title }),
    ...(firstAction !== undefined && { first_action: firstAction || null }),
    ...(estimate !== undefined && { estimate_minutes: estimate }),
    ...(energy !== undefined && { energy }),
    ...(projectId !== undefined && { project_id: projectId }),
    ...(doneWhen !== undefined && { done_when: doneWhen || null }),
    ...(ifThenTrigger !== undefined && { if_then_trigger: ifThenTrigger || null, if_then_minute: ifThenTrigger ? ifThenMinute ?? null : null }),
    last_touched_at: now.toISOString(),
  }).eq('id', id)
  if (error) return fail('Could not save the task.')
  return done()
}

export async function reorderTasks(ids: string[]): Promise<Result> {
  const p = z.array(uuid).max(20).safeParse(ids)
  if (!p.success) return fail('Invalid request.')
  const { supabase } = await getViewer()
  await Promise.all(p.data.map((id, i) => supabase.from('tasks').update({ sort_order: i + 1 }).eq('id', id)))
  return done()
}

export async function deleteTask(id: string): Promise<Result> {
  if (!uuid.safeParse(id).success) return fail('Invalid request.')
  const { supabase } = await getViewer()
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) return fail('Could not delete the task.')
  return done()
}

/** "Hide until…" (null = show now). Hiding is a decision about the task, so it also leaves the aging queue. */
export async function hideTask(id: string, until: string | null): Promise<Result> {
  const p = z.object({ id: uuid, until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }).safeParse({ id, until })
  if (!p.success) return fail('Invalid date.')
  const { supabase, today, now } = await getViewer()
  if (p.data.until && p.data.until <= today) return fail('Pick a day after today.')
  const { error } = await supabase.from('tasks').update({ hidden_until: p.data.until, last_touched_at: now.toISOString() }).eq('id', p.data.id)
  if (error) return fail('Could not update the task.')
  return done()
}

export interface TaskHit { id: string; title: string; firstAction: string | null; status: string }

/** Command palette search (Ctrl+K): open tasks whose title matches. */
export async function searchTasks(q: string): Promise<TaskHit[]> {
  const query = String(q ?? '').trim().slice(0, 80)
  if (query.length < 2) return []
  const { supabase } = await getViewer()
  const safe = query.replace(/[%_\\,()]/g, ' ')
  const { data } = await supabase.from('tasks').select('id, title, first_action, status')
    .in('status', ['inbox', 'today', 'evening', 'backlog', 'someday']).ilike('title', `%${safe}%`)
    .order('last_touched_at', { ascending: false }).limit(8)
  return (data ?? []).map((t) => ({ id: t.id, title: t.title, firstAction: t.first_action, status: t.status }))
}

/**
 * Add straight onto Today (UI v0.6: "add, press ▶"). Dates still work ("tomorrow 3pm" hides it until then).
 * When Today is full, it lands in Ideas instead — nothing is lost.
 */
export async function addToToday(raw: string): Promise<Result & { where?: 'today' | 'ideas' | 'later' }> {
  const { supabase, settings, today, now } = await getViewer()
  const parsed = parseCapture(String(raw ?? '').slice(0, 600), today)
  if (!parsed.title) return fail('Write something to add.')
  let projectId: string | null = null
  let title = parsed.title
  if (parsed.projectName) {
    const { data: project } = await supabase.from('projects').select('id').eq('name', parsed.projectName).maybeSingle()
    if (project) projectId = project.id
    else title = `${title} #${parsed.projectName}`
  }
  const later = !!parsed.showOn && parsed.showOn > today
  const { count } = await supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['today', 'evening'])
  const full = (count ?? 0) >= settings.wip_cap
  const status = later ? 'backlog' : full ? 'inbox' : 'today'
  const { data: last } = await supabase.from('tasks').select('sort_order').in('status', ['today', 'evening']).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const { error } = await supabase.from('tasks').insert({
    title: title.slice(0, 500), project_id: projectId, estimate_minutes: parsed.estimateMinutes, energy: parsed.energy, kind: parsed.kind,
    status, planned_for: status === 'today' ? today : null, first_planned_at: status === 'today' ? now.toISOString() : null,
    sort_order: (last?.sort_order ?? 0) + 1,
    hidden_until: later ? parsed.showOn : null,
    if_then_minute: parsed.atMinute, if_then_trigger: parsed.atMinute !== null ? `Start: ${title}`.slice(0, 200) : null,
  })
  if (error) return fail('Could not save. Please try again.')
  revalidatePath('/', 'layout')
  return { ok: true, where: later ? 'later' : full ? 'ideas' : 'today' }
}
