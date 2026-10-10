'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getViewer } from '@/lib/data/viewer'
import { loadSkills } from '@/lib/data/skills'
import { loadWeekActivity } from '@/lib/data/training'
import { MISSIONS, missionProgress } from '@/domain/training/missions'
import { addDays, dayOfWeek, localDayMinute } from '@/domain/time/day'
import { reflectionQuestion } from '@/domain/training/week'
import type { SkillId } from '@/domain/skills/skills'
import { commitWeek } from './calendar'
import type { Result } from './tasks'

const uuid = z.string().uuid()
const weekKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((k) => dayOfWeek(k) === 0, 'Not a week start.')
const SKILLS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'] as const
const ok = (): Result => {
  revalidatePath('/', 'layout')
  return { ok: true }
}

// ───────────── weekly review ─────────────

export async function setReviewStep(week: string, step: number): Promise<Result> {
  const p = z.object({ week: weekKey, step: z.number().int().min(1).max(9) }).safeParse({ week, step })
  if (!p.success) return { ok: false, error: 'Invalid step.' }
  const { supabase, userId } = await getViewer()
  const { error } = await supabase.from('reviews').upsert({ owner_id: userId, week_start: p.data.week, step: p.data.step }, { onConflict: 'owner_id,week_start' })
  return error ? { ok: false, error: 'Could not save progress.' } : { ok: true }
}

/** This week's three outcomes (DESIGN F57). Empty lines remove an outcome. */
export async function saveOutcomes(week: string, texts: string[]): Promise<Result> {
  const p = z.object({ week: weekKey, texts: z.array(z.string().trim().max(200)).max(3) }).safeParse({ week, texts })
  if (!p.success) return { ok: false, error: 'Keep each outcome under 200 characters.' }
  const { supabase, userId } = await getViewer()
  const rows = p.data.texts.map((text, i) => ({ text, i })).filter((x) => x.text)
  const keep = rows.map((r) => r.i)
  const del = supabase.from('outcomes').delete().eq('week_start', p.data.week)
  const { error: delErr } = keep.length ? await del.not('sort_order', 'in', `(${keep.join(',')})`) : await del
  if (delErr) return { ok: false, error: 'Could not save outcomes.' }
  if (rows.length) {
    const { error } = await supabase.from('outcomes').upsert(
      rows.map((r) => ({ owner_id: userId, week_start: p.data.week, sort_order: r.i, text: r.text })),
      { onConflict: 'owner_id,week_start,sort_order' },
    )
    if (error) return { ok: false, error: 'Could not save outcomes.' }
  }
  return ok()
}

export async function gradeOutcome(id: string, result: 'met' | 'partial' | 'missed'): Promise<Result> {
  const p = z.object({ id: uuid, result: z.enum(['met', 'partial', 'missed']) }).safeParse({ id, result })
  if (!p.success) return { ok: false, error: 'Invalid grade.' }
  const { supabase, now } = await getViewer()
  const { error } = await supabase.from('outcomes').update({ result: p.data.result, graded_at: now.toISOString() }).eq('id', p.data.id)
  return error ? { ok: false, error: 'Could not grade.' } : ok()
}

/** Weekly goal forecast: "How likely are you to deliver this week's hours?" (resolved next week → Brier). */
export async function setConfidence(goalId: string, week: string, pct: number): Promise<Result> {
  const p = z.object({ goalId: uuid, week: weekKey, pct: z.number().int().min(0).max(100) }).safeParse({ goalId, week, pct })
  if (!p.success) return { ok: false, error: 'Invalid forecast.' }
  const { supabase, userId } = await getViewer()
  const { error } = await supabase.from('goal_confidence').upsert(
    { owner_id: userId, goal_id: p.data.goalId, week_start: p.data.week, confidence_pct: p.data.pct },
    { onConflict: 'goal_id,week_start' },
  )
  return error ? { ok: false, error: 'Could not save the forecast.' } : { ok: true }
}

/** Choose (or clear) the week's main drill / side mission. Records the skill metric "before". */
export async function setMission(week: string, kind: 'main' | 'side', skill: SkillId | null): Promise<Result> {
  const p = z.object({ week: weekKey, kind: z.enum(['main', 'side']), skill: z.enum(SKILLS).nullable() }).safeParse({ week, kind, skill })
  if (!p.success) return { ok: false, error: 'Invalid mission.' }
  const { supabase, userId } = await getViewer()
  if (!p.data.skill) {
    await supabase.from('missions').delete().eq('week_start', p.data.week).eq('kind', p.data.kind)
    return ok()
  }
  const { data: other } = await supabase.from('missions').select('skill').eq('week_start', p.data.week).neq('kind', p.data.kind).maybeSingle()
  if (other?.skill === p.data.skill) return { ok: false, error: 'Pick a different skill for the side mission.' }
  const s = await loadSkills()
  const def = MISSIONS[p.data.skill]
  const { error } = await supabase.from('missions').upsert({
    owner_id: userId, week_start: p.data.week, kind: p.data.kind, skill: p.data.skill, title: def.title, target: def.target,
    result_before: s.byId[p.data.skill].value, result_after: null, progress: null, completed_at: null,
  }, { onConflict: 'owner_id,week_start,kind' })
  return error ? { ok: false, error: 'Could not save the mission.' } : ok()
}

/**
 * Final review step: commit the planned week, close the review, and settle the reviewed week's missions
 * (final progress, completion stamp, skill metric "after").
 */
export async function closeReview(week: string): Promise<Result & { firstBlock?: string | null }> {
  const p = weekKey.safeParse(week)
  if (!p.success) return { ok: false, error: 'Invalid week.' }
  const v = await getViewer()
  const committed = await commitWeek(p.data)
  if (!committed.ok) return committed

  const reviewed = addDays(p.data, -7)
  const { data: past } = await v.supabase.from('missions').select('id, skill, target, progress').eq('week_start', reviewed)
  if (past?.length) {
    const [activity, s] = await Promise.all([loadWeekActivity(v, reviewed), loadSkills()])
    await Promise.all(past.map((m) => {
      const progress = missionProgress(m.skill as SkillId, activity)
      return v.supabase.from('missions').update({
        progress, result_after: s.byId[m.skill as SkillId].value,
        completed_at: progress >= m.target ? v.now.toISOString() : null,
      }).eq('id', m.id)
    }))
  }
  await v.supabase.from('reviews').upsert({ owner_id: v.userId, week_start: p.data, step: 9, closed_at: v.now.toISOString() }, { onConflict: 'owner_id,week_start' })

  const { data: first } = await v.supabase.from('calendar_blocks').select('start_at').eq('status', 'committed')
    .gte('start_at', v.now.toISOString()).order('start_at').limit(1).maybeSingle()
  let firstBlock: string | null = null
  if (first) {
    const at = new Date(first.start_at)
    const day = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: v.profile.timezone }).format(at)
    const { minute } = localDayMinute(at, v.profile.timezone)
    firstBlock = `${day} ${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
  }
  revalidatePath('/', 'layout')
  return { ok: true, firstBlock }
}

// ───────────── personal records ─────────────

export async function markRecordsSeen(): Promise<Result> {
  const { supabase, now } = await getViewer()
  await supabase.from('personal_records').update({ seen_at: now.toISOString() }).is('seen_at', null)
  return ok()
}

// ───────────── habits ─────────────

export async function createHabit(name: string, weekdays: number[]): Promise<Result> {
  const p = z.object({ name: z.string().trim().min(1, 'Name the habit.').max(80), weekdays: z.array(z.number().int().min(0).max(6)).min(1, 'Pick at least one day.').max(7) })
    .safeParse({ name, weekdays })
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Invalid habit.' }
  const { supabase } = await getViewer()
  const { count } = await supabase.from('habits').select('id', { count: 'exact', head: true }).eq('active', true)
  if ((count ?? 0) >= 7) return { ok: false, error: 'Seven active habits is plenty. Archive one first.' }
  const { error } = await supabase.from('habits').insert({ name: p.data.name, weekdays: [...new Set(p.data.weekdays)].sort() })
  return error ? { ok: false, error: 'Could not add the habit.' } : ok()
}

export async function toggleHabit(id: string, day: string, done: boolean): Promise<Result> {
  const p = z.object({ id: uuid, day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), done: z.boolean() }).safeParse({ id, day, done })
  if (!p.success) return { ok: false, error: 'Invalid request.' }
  const { supabase, today, userId } = await getViewer()
  if (p.data.day > today || p.data.day < addDays(today, -6)) return { ok: false, error: 'You can only log the last 7 days.' }
  const { error } = p.data.done
    ? await supabase.from('habit_logs').upsert({ owner_id: userId, habit_id: p.data.id, day: p.data.day }, { onConflict: 'habit_id,day', ignoreDuplicates: true })
    : await supabase.from('habit_logs').delete().eq('habit_id', p.data.id).eq('day', p.data.day)
  return error ? { ok: false, error: 'Could not update the habit.' } : ok()
}

export async function archiveHabit(id: string, active: boolean): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Invalid request.' }
  const { supabase } = await getViewer()
  const { error } = await supabase.from('habits').update({ active }).eq('id', id)
  return error ? { ok: false, error: 'Could not update the habit.' } : ok()
}

// ───────────── aging queue ─────────────

/** "This week": keep it, deliberately — resets its age so it returns only if left untouched again. */
export async function keepTask(id: string): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Invalid request.' }
  const { supabase, now } = await getViewer()
  const { error } = await supabase.from('tasks').update({ last_touched_at: now.toISOString() }).eq('id', id)
  return error ? { ok: false, error: 'Could not update the task.' } : ok()
}

export async function restoreTask(id: string): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Invalid request.' }
  const { supabase, now } = await getViewer()
  const { error } = await supabase.from('tasks').update({ status: 'backlog', killed_at: null, last_touched_at: now.toISOString() }).eq('id', id).eq('status', 'killed')
  return error ? { ok: false, error: 'Could not restore the task.' } : ok()
}

// ───────────── daily reflection ─────────────

export async function saveReflection(text: string): Promise<Result> {
  const p = z.string().trim().max(500).safeParse(text)
  if (!p.success) return { ok: false, error: 'Keep it under 500 characters.' }
  const { supabase, userId, today } = await getViewer()
  const { error } = await supabase.from('day_plans').upsert(
    { owner_id: userId, day: today, reflection_question: reflectionQuestion(today), reflection_text: p.data || null },
    { onConflict: 'owner_id,day' },
  )
  return error ? { ok: false, error: 'Could not save.' } : { ok: true }
}
