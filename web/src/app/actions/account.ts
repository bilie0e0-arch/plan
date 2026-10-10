'use server'

import { redirect } from 'next/navigation'
import { getViewer } from '@/lib/data/viewer'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { Result } from './tasks'

/** Permanently deletes the account: audio files first, then the auth user (all rows cascade). */
export async function deleteAccount(confirmUsername: string): Promise<Result> {
  const { userId, profile } = await getViewer()
  if (confirmUsername.trim().toLowerCase() !== profile.username) return { ok: false, error: 'Type your username exactly to confirm.' }
  const admin = createAdminClient()
  for (;;) {
    const { data: files } = await admin.storage.from('recordings').list(userId, { limit: 100 })
    if (!files?.length) break
    await admin.storage.from('recordings').remove(files.map((f) => `${userId}/${f.name}`))
    if (files.length < 100) break
  }
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { ok: false, error: 'Could not delete the account. Please try again.' }
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/signup')
}
