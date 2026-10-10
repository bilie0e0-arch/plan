'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getViewer } from '@/lib/data/viewer'
import type { Result } from './tasks'

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(5).max(100) }),
})

export async function savePushSubscription(sub: unknown): Promise<Result> {
  const p = subSchema.safeParse(sub)
  if (!p.success) return { ok: false, error: 'Invalid subscription.' }
  const { supabase, userId } = await getViewer()
  await supabase.from('push_subscriptions').delete().eq('endpoint', p.data.endpoint)
  const { error } = await supabase.from('push_subscriptions').insert({ endpoint: p.data.endpoint, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth })
  if (error) return { ok: false, error: 'Could not enable notifications.' }
  await supabase.from('settings').update({ push_enabled: true }).eq('owner_id', userId)
  revalidatePath('/settings')
  return { ok: true }
}

export async function disablePush(): Promise<Result> {
  const { supabase, userId } = await getViewer()
  await supabase.from('push_subscriptions').delete().eq('owner_id', userId)
  await supabase.from('settings').update({ push_enabled: false }).eq('owner_id', userId)
  revalidatePath('/settings')
  return { ok: true }
}
