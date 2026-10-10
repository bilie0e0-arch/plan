'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getViewer } from '@/lib/data/viewer'
import { isValidTimeZone } from '@/domain/auth/validation'
import type { Result } from './tasks'

const profileSchema = z.object({
  displayName: z.string().trim().max(60).nullable(),
  timezone: z.string().refine(isValidTimeZone, 'Unknown timezone.'),
  dayBoundaryHour: z.number().int().min(0).max(23),
})

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<Result> {
  const p = profileSchema.safeParse(input)
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Invalid profile.' }
  const { supabase, userId } = await getViewer()
  const { error } = await supabase.from('profiles').update({
    display_name: p.data.displayName || null, timezone: p.data.timezone, day_boundary_hour: p.data.dayBoundaryHour,
  }).eq('user_id', userId)
  if (error) return { ok: false, error: 'Could not save your profile.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

const settingsSchema = z.object({
  wipCap: z.number().int().min(3).max(9),
  activeProjectCap: z.number().int().min(3).max(7),
  availableHours: z.number().min(0.5).max(16),
  coachTone: z.enum(['calm', 'direct', 'playful']).optional(),
  dailyPromptBudget: z.number().int().min(0).max(10),
  soundEnabled: z.boolean(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  overrides: z.record(z.enum(['now_card', 'timer_mode', 'morning_ritual', 'session_goal']), z.enum(['more', 'auto', 'less'])),
})

export async function updateSettings(input: z.input<typeof settingsSchema>): Promise<Result> {
  const p = settingsSchema.safeParse(input)
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Invalid settings.' }
  const { supabase, userId } = await getViewer()
  const d = p.data
  const { error } = await supabase.from('settings').update({
    wip_cap: d.wipCap, active_project_cap: d.activeProjectCap,
    default_available_minutes: Math.round(d.availableHours * 60),
    ...(d.coachTone && { coach_tone: d.coachTone }), daily_prompt_budget: d.dailyPromptBudget,
    sound_enabled: d.soundEnabled, ...(d.theme && { theme: d.theme }), guide_overrides: d.overrides,
  }).eq('owner_id', userId)
  if (error) return { ok: false, error: 'Could not save settings.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

const calendarSchema = z.object({
  dayStartHour: z.number().int().min(0).max(23),
  dayEndHour: z.number().int().min(1).max(24),
  quietStartHour: z.number().int().min(0).max(23),
  quietEndHour: z.number().int().min(0).max(23),
  icsUrl: z.string().trim().max(1000).refine((u) => u === '' || /^https:\/\//.test(u), 'The iCal link must start with https://'),
  checklist: z.array(z.string().trim().min(1).max(60)).max(8),
}).refine((d) => d.dayEndHour > d.dayStartHour, 'Your day must end after it starts.')

export async function updateCalendarSettings(input: z.input<typeof calendarSchema>): Promise<Result> {
  const p = calendarSchema.safeParse(input)
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Invalid settings.' }
  const { supabase, userId } = await getViewer()
  const d = p.data
  const { error } = await supabase.from('settings').update({
    day_start_hour: d.dayStartHour, day_end_hour: d.dayEndHour, quiet_start_hour: d.quietStartHour, quiet_end_hour: d.quietEndHour,
    ics_url: d.icsUrl || null, ics_fetched_at: null, setup_checklist: d.checklist,
  }).eq('owner_id', userId)
  if (error) return { ok: false, error: 'Could not save.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

const speakingSchema = z.object({
  fillerWords: z.array(z.string().trim().toLowerCase().min(1).max(30)).min(1).max(30),
  audioRetentionDays: z.number().int().min(7).max(3650).nullable(),
  keepAudio: z.boolean(),
})

export async function updateSpeakingSettings(input: z.input<typeof speakingSchema>): Promise<Result> {
  const p = speakingSchema.safeParse(input)
  if (!p.success) return { ok: false, error: 'Check the filler list.' }
  const { supabase, userId } = await getViewer()
  const { error } = await supabase.from('settings').update({
    filler_words: [...new Set(p.data.fillerWords)], audio_retention_days: p.data.audioRetentionDays, keep_audio: p.data.keepAudio,
  }).eq('owner_id', userId)
  if (error) return { ok: false, error: 'Could not save.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

const trainingSchema = z.object({ agingDays: z.number().int().min(7).max(60), personalBands: z.boolean() })

export async function updateTrainingSettings(input: z.input<typeof trainingSchema>): Promise<Result> {
  const p = trainingSchema.safeParse(input)
  if (!p.success) return { ok: false, error: 'Invalid settings.' }
  const { supabase, userId } = await getViewer()
  const { error } = await supabase.from('settings').update({ aging_days: p.data.agingDays, personal_bands: p.data.personalBands }).eq('owner_id', userId)
  if (error) return { ok: false, error: 'Could not save.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

const AREAS = ['focus', 'planning', 'speaking', 'habits'] as const
const essentialsSchema = z.object({
  focusAreas: z.array(z.enum(AREAS)).max(4),
  coachTone: z.enum(['calm', 'direct', 'playful']),
  theme: z.enum(['system', 'light', 'dark']),
  workKind: z.enum(['exam', 'skill', 'work', 'creative', 'habits']).optional(),
  dailyMinutes: z.number().int().min(10).max(720).optional(),
})

/** Essentials: what you want to get better at (sets emphasis, never hides anything), coach voice, theme. */
export async function updateEssentials(input: z.input<typeof essentialsSchema>): Promise<Result> {
  const p = essentialsSchema.safeParse(input)
  if (!p.success) return { ok: false, error: 'Invalid settings.' }
  const { supabase, userId } = await getViewer()
  const { error } = await supabase.from('settings').update({
    focus_areas: [...new Set(p.data.focusAreas)], coach_tone: p.data.coachTone, theme: p.data.theme,
    ...(p.data.workKind ? { work_kind: p.data.workKind } : {}),
    ...(p.data.dailyMinutes ? { daily_focus_minutes: p.data.dailyMinutes } : {}),
  }).eq('owner_id', userId)
  if (error) return { ok: false, error: 'Could not save.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** First-run setup. Skipping is fine: it just records that we asked. A named project is created once. */
const onboardingSchema = z.object({
  focusAreas: z.array(z.enum(AREAS)).max(4),
  workKind: z.enum(['exam', 'skill', 'work', 'creative', 'habits']).optional(),
  projectName: z.string().trim().min(1).max(60).optional(),
  dailyMinutes: z.number().int().min(10).max(720).optional(),
})
export async function completeOnboarding(input: z.input<typeof onboardingSchema>): Promise<Result> {
  const p = onboardingSchema.safeParse(input)
  if (!p.success) return { ok: false, error: 'Invalid choice.' }
  const { supabase, userId, now } = await getViewer()
  const { error } = await supabase.from('settings').update({
    focus_areas: [...new Set(p.data.focusAreas)], onboarded_at: now.toISOString(),
    ...(p.data.workKind ? { work_kind: p.data.workKind } : {}),
    ...(p.data.dailyMinutes ? { daily_focus_minutes: p.data.dailyMinutes } : {}),
  }).eq('owner_id', userId)
  if (error) return { ok: false, error: 'Could not save.' }
  if (p.data.projectName) {
    // Weekly hours follow the daily target over six days; an existing project with that name is kept as is.
    const weekly = Math.round((p.data.dailyMinutes ?? 60) * 6)
    const { error: e } = await supabase.from('projects').insert({ name: p.data.projectName, color: 'teal', weekly_budget_minutes: weekly, status: 'active' })
    if (e && e.code !== '23505') return { ok: false, error: 'Saved, but could not create the project.' }
  }
  revalidatePath('/', 'layout')
  return { ok: true }
}
