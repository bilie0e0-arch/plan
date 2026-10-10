'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getViewer } from '@/lib/data/viewer'
import type { Result } from './tasks'

export async function recordDecision(area: 'next_task' | 'timer_mode', source: 'self' | 'suggestion_accepted' | 'suggestion_modified'): Promise<Result> {
  const p = z.object({ area: z.enum(['next_task', 'timer_mode']), source: z.enum(['self', 'suggestion_accepted', 'suggestion_modified']) }).safeParse({ area, source })
  if (!p.success) return { ok: false, error: 'Invalid request.' }
  const { supabase } = await getViewer()
  await supabase.from('decision_events').insert(p.data)
  return { ok: true }
}

export async function markPromptShown(type: string): Promise<Result> {
  const { supabase, userId, today } = await getViewer()
  await supabase.from('guide_prompts').upsert({ owner_id: userId, type, shown_on: today }, { onConflict: 'owner_id,type,shown_on', ignoreDuplicates: true })
  return { ok: true }
}

export async function resolvePrompt(type: string, outcome: 'acted' | 'dismissed'): Promise<Result> {
  const p = z.object({ type: z.string().max(40), outcome: z.enum(['acted', 'dismissed']) }).safeParse({ type, outcome })
  if (!p.success) return { ok: false, error: 'Invalid request.' }
  const { supabase, today, now } = await getViewer()
  await supabase.from('guide_prompts').update({ outcome: p.data.outcome, resolved_at: now.toISOString() }).eq('type', p.data.type).eq('shown_on', today)
  revalidatePath('/', 'layout')
  return { ok: true }
}
