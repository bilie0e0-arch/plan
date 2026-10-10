import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { dayKey } from '@/domain/time/day'
import type { Tone } from '@/domain/guide/copy'
import type { Override } from '@/domain/skills/skills'

export interface GuideOverrides {
  now_card?: Override
  timer_mode?: Override
  morning_ritual?: Override
  session_goal?: Override
}

/** Current user + profile + settings, resolved once per request. Redirects to /login if signed out. */
export const getViewer = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, settingsRes, ladderRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).single(),
    supabase.from('settings').select('*').eq('owner_id', user.id).single(),
    supabase.from('ladder_state').select('*').eq('owner_id', user.id).single(),
  ])
  if (!profileRes.data || !settingsRes.data || !ladderRes.data) redirect('/login')

  const profile = profileRes.data
  const settings = settingsRes.data
  const now = new Date()
  return {
    supabase,
    userId: user.id,
    profile,
    settings,
    ladder: ladderRes.data,
    tone: settings.coach_tone as Tone,
    overrides: (settings.guide_overrides ?? {}) as GuideOverrides,
    now,
    today: dayKey(now, profile.timezone, profile.day_boundary_hour),
    daysSinceSignup: Math.floor((now.getTime() - new Date(profile.created_at).getTime()) / 86_400_000),
  }
})

export type Viewer = Awaited<ReturnType<typeof getViewer>>
