import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { chunks } from '@/lib/supabase/paging'

/** Actual focused seconds per task (RLS-scoped view), fetched in URL-safe chunks. */
export async function actualSecondsByTask(supabase: SupabaseClient<Database>, ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const parts = await Promise.all(chunks([...new Set(ids)]).map((part) =>
    supabase.from('task_actuals').select('task_id, actual_seconds').in('task_id', part)))
  for (const { data } of parts) for (const a of data ?? []) if (a.task_id) out.set(a.task_id, a.actual_seconds ?? 0)
  return out
}
