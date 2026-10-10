'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getViewer } from '@/lib/data/viewer'
import { PROJECT_COLORS } from '@/domain/projects/colors'
import type { Result } from './tasks'

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name the project.')
  .max(40, 'Keep it under 40 characters.')
  .regex(/^[\w-]+$/, 'Use letters, digits, - or _ so you can tag it with #name.')

export async function createProject(input: { name: string; color: string; weeklyHours: number }): Promise<Result> {
  const p = z.object({
    name: nameSchema,
    color: z.enum(PROJECT_COLORS),
    weeklyHours: z.number().min(0).max(80),
  }).safeParse(input)
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Invalid project.' }
  const { supabase, settings } = await getViewer()
  const { count } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'active')
  const status = (count ?? 0) >= settings.active_project_cap ? 'paused' : 'active'
  const { error } = await supabase.from('projects').insert({
    name: p.data.name, color: p.data.color, weekly_budget_minutes: Math.round(p.data.weeklyHours * 60), status,
  })
  if (error?.code === '23505') return { ok: false, error: 'You already have a project with that name.' }
  if (error) return { ok: false, error: 'Could not create the project.' }
  revalidatePath('/', 'layout')
  return status === 'paused'
    ? { ok: false, error: `Created as paused — you already have ${settings.active_project_cap} active projects. Pause one to activate it.` }
    : { ok: true }
}

export async function updateProject(input: { id: string; status?: string; weeklyHours?: number; color?: string; name?: string }): Promise<Result> {
  const p = z.object({
    id: z.string().uuid(),
    status: z.enum(['active', 'paused', 'done']).optional(),
    weeklyHours: z.number().min(0).max(80).optional(),
    color: z.enum(PROJECT_COLORS).optional(),
    name: nameSchema.optional(),
  }).safeParse(input)
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Invalid request.' }
  const { supabase, settings } = await getViewer()
  if (p.data.status === 'active') {
    const { count } = await supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'active').neq('id', p.data.id)
    if ((count ?? 0) >= settings.active_project_cap) {
      return { ok: false, error: `${settings.active_project_cap} projects are already active. Pause one first.` }
    }
  }
  const { error } = await supabase.from('projects').update({
    ...(p.data.status && { status: p.data.status }),
    ...(p.data.weeklyHours !== undefined && { weekly_budget_minutes: Math.round(p.data.weeklyHours * 60) }),
    ...(p.data.color && { color: p.data.color }),
    ...(p.data.name && { name: p.data.name }),
  }).eq('id', p.data.id)
  if (error?.code === '23505') return { ok: false, error: 'You already have a project with that name.' }
  if (error) return { ok: false, error: 'Could not update the project.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}
