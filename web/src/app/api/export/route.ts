import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/paging'

export const dynamic = 'force-dynamic'

const TABLES = [
  'profiles', 'settings', 'projects', 'tasks', 'day_plans', 'sessions', 'distractions', 'breaks', 'ladder_state',
  'goals', 'milestones', 'goal_projects', 'block_series', 'calendar_blocks', 'commitments', 'commitment_revisions',
  'block_outcomes', 'recordings', 'speaking_prompts', 'decision_events', 'guide_prompts',
  'reviews', 'outcomes', 'missions', 'personal_records', 'habits', 'habit_logs', 'goal_confidence',
  'partner_requests', 'session_invites', 'reactions', 'shared_lists', 'shared_list_items',
] as const

/** Stable sort keys for tables without an `id` column. */
const ORDER: Partial<Record<(typeof TABLES)[number], string[]>> = {
  profiles: ['user_id'], settings: ['owner_id'], ladder_state: ['owner_id'], day_plans: ['day'],
  goal_projects: ['goal_id', 'project_id'], block_outcomes: ['block_id'], personal_records: ['record_type'],
  habit_logs: ['habit_id', 'day'], goal_confidence: ['goal_id', 'week_start'],
}

/** Full JSON export of the signed-in user's data (RLS limits every query to their own rows). */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), note: 'Audio files can be downloaded from each recording in the app.' }
  for (const t of TABLES) {
    // Responses are capped at 1000 rows, so page through each table in a stable order.
    const data = await fetchAll((a, b) => {
      let q = supabase.from(t).select('*')
      for (const col of ORDER[t] ?? ['id']) q = q.order(col as never)
      return q.range(a, b)
    })
    out[t] = t === 'speaking_prompts' ? data.filter((r) => (r as { owner_id: string | null }).owner_id) : data
  }
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="plan-export-${new Date().toISOString().slice(0, 10)}.json"` },
  })
}
