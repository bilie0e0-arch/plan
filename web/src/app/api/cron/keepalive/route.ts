import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const got = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!secret || !got || got.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret))
}

/**
 * Daily keep-alive (Vercel Cron, see vercel.json): one real database read through the Supabase API,
 * so a free-tier project never counts as inactive and pauses after 7 quiet days.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { count, error } = await createAdminClient().from('speaking_prompts').select('id', { count: 'exact', head: true })
  if (error) return NextResponse.json({ ok: false }, { status: 503 })
  return NextResponse.json({ ok: true, prompts: count, at: new Date().toISOString() })
}
