'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getViewer } from '@/lib/data/viewer'
import { activeSeconds, classifyOutcome, isClean, plannedMinutesFor, suggestedBreakMinutes, type TimerMode } from '@/domain/focus/session'
import { acceptStepDown, applySession, calibrate, dismissStepDown, type LadderState } from '@/domain/focus/ladder'
import type { Result } from './tasks'

const MODES = ['ladder', 'blind', 'starter', 'timebox', 'free'] as const
const uuid = z.string().uuid()

function toLadder(row: { current_rung: number; clean_count: number; consecutive_misses: number; suggest_down: boolean; calibrated: boolean }): LadderState {
  return { currentRung: row.current_rung, cleanCount: row.clean_count, consecutiveMisses: row.consecutive_misses, suggestDown: row.suggest_down, calibrated: row.calibrated }
}
function fromLadder(s: LadderState) {
  return { current_rung: s.currentRung, clean_count: s.cleanCount, consecutive_misses: s.consecutiveMisses, suggest_down: s.suggestDown, calibrated: s.calibrated, updated_at: new Date().toISOString() }
}

export async function startSession(input: {
  taskId: string; mode: TimerMode; suggestedMode: TimerMode | null; goal: string | null; predicted: number | null; blockId?: string | null; plannedMinutes?: number | null
}): Promise<{ ok: true; id: string; startedAt: string; plannedMinutes: number | null } | { ok: false; error: string }> {
  const p = z.object({
    taskId: uuid, mode: z.enum(MODES), suggestedMode: z.enum(MODES).nullable(),
    goal: z.string().trim().max(200).nullable(), predicted: z.number().int().min(1).max(1440).nullable(),
    blockId: uuid.nullable().optional(),
    plannedMinutes: z.number().int().min(1).max(600).nullable().optional(),
  }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Invalid session.' }
  if (p.data.mode === 'blind' && !p.data.predicted) return { ok: false, error: 'Guess the time first — how many minutes will it take?' }

  const { supabase, ladder, now } = await getViewer()
  const { data: task } = await supabase.from('tasks').select('id, estimate_minutes, first_started_at').eq('id', p.data.taskId).single()
  if (!task) return { ok: false, error: 'Task not found.' }

  // A block's own length sizes a timebox; otherwise the mode decides (ladder rung, estimate, starter 5).
  const planned = p.data.mode === 'timebox' && p.data.plannedMinutes ? p.data.plannedMinutes : plannedMinutesFor(p.data.mode, ladder.current_rung, task.estimate_minutes)
  const { data, error } = await supabase.from('sessions').insert({
    task_id: task.id,
    mode: p.data.mode,
    suggested_mode: p.data.suggestedMode,
    goal_text: p.data.goal || null,
    predicted_minutes: p.data.predicted,
    planned_minutes: planned,
    ladder_rung: p.data.mode === 'ladder' ? ladder.current_rung : null,
    started_at: now.toISOString(),
    block_id: p.data.blockId ?? null,
  }).select('id, started_at').single()
  if (error?.code === '23505') return { ok: false, error: 'A session is already running. Finish it first.' }
  if (error || !data) return { ok: false, error: 'Could not start the session.' }

  await Promise.all([
    supabase.from('tasks').update({ first_started_at: task.first_started_at ?? now.toISOString(), last_touched_at: now.toISOString() }).eq('id', task.id),
    p.data.suggestedMode
      ? supabase.from('decision_events').insert({ area: 'timer_mode', source: p.data.mode === p.data.suggestedMode ? 'suggestion_accepted' : 'self' })
      : Promise.resolve(),
  ])
  revalidatePath('/', 'layout')
  return { ok: true, id: data.id, startedAt: data.started_at, plannedMinutes: planned }
}

export async function pauseSession(id: string): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Invalid request.' }
  const { supabase, now } = await getViewer()
  const { error } = await supabase.from('sessions').update({ paused_at: now.toISOString() }).eq('id', id).is('paused_at', null).is('ended_at', null)
  return error ? { ok: false, error: 'Could not pause.' } : { ok: true }
}

export async function resumeSession(id: string): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Invalid request.' }
  const { supabase, now } = await getViewer()
  const { data: s } = await supabase.from('sessions').select('paused_at, paused_seconds').eq('id', id).single()
  if (!s?.paused_at) return { ok: true }
  const add = Math.max(0, Math.round((now.getTime() - new Date(s.paused_at).getTime()) / 1000))
  const { error } = await supabase.from('sessions').update({ paused_at: null, paused_seconds: s.paused_seconds + add }).eq('id', id)
  return error ? { ok: false, error: 'Could not resume.' } : { ok: true }
}

/** Starter: user chose "Keep going" at 5 minutes — the session becomes open-ended. */
export async function extendStarter(id: string): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Invalid request.' }
  const { supabase } = await getViewer()
  const { error } = await supabase.from('sessions').update({ planned_minutes: null }).eq('id', id).eq('mode', 'starter')
  return error ? { ok: false, error: 'Could not extend.' } : { ok: true }
}

export async function logDistraction(input: { sessionId: string; kind: 'internal' | 'external'; note?: string }): Promise<Result> {
  const p = z.object({ sessionId: uuid, kind: z.enum(['internal', 'external']), note: z.string().trim().max(80).optional() }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Invalid request.' }
  const { supabase } = await getViewer()
  const { error } = await supabase.from('distractions').insert({ session_id: p.data.sessionId, kind: p.data.kind, note: p.data.note || null })
  return error ? { ok: false, error: 'Could not log it.' } : { ok: true }
}

export interface StopResult {
  ok: true
  outcome: 'completed' | 'stopped_early' | 'abandoned'
  activeMinutes: number
  plannedMinutes: number | null
  predictedMinutes: number | null
  mode: TimerMode
  distractions: number
  clean: boolean
  ladderEvent: 'climbed' | 'suggest_down' | null
  rung: number
  cleanCount: number
  breakMinutes: number
}

/** Stop the timer (server time is the source of truth) and update the ladder. */
export async function stopSession(input: { id: string; discarded: boolean }): Promise<StopResult | { ok: false; error: string }> {
  const p = z.object({ id: uuid, discarded: z.boolean() }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Invalid request.' }
  const { supabase, now, daysSinceSignup } = await getViewer()
  const { data: s } = await supabase.from('sessions').select('*').eq('id', p.data.id).single()
  if (!s || s.ended_at) return { ok: false, error: 'Session already ended.' }

  const seconds = activeSeconds(new Date(s.started_at), now, s.paused_seconds, s.paused_at ? new Date(s.paused_at) : null)
  const mode = s.mode as TimerMode
  const outcome = classifyOutcome(mode, s.planned_minutes, seconds, p.data.discarded)
  const { count } = await supabase.from('distractions').select('id', { count: 'exact', head: true }).eq('session_id', s.id)
  const distractions = count ?? 0
  const clean = isClean(outcome, distractions)

  const { error } = await supabase.from('sessions').update({
    ended_at: now.toISOString(),
    paused_at: null,
    active_seconds: seconds,
    outcome,
    is_clean: clean,
    overran: mode === 'timebox' && !!s.planned_minutes && seconds > s.planned_minutes * 60,
  }).eq('id', s.id)
  if (error) return { ok: false, error: 'Could not stop the session.' }

  const { data: ladderRow } = await supabase.from('ladder_state').select('*').single()
  let state = toLadder(ladderRow!)
  const applied = applySession(state, { mode, plannedMinutes: s.planned_minutes, outcome, distractions })
  state = applied.state
  if (!state.calibrated && daysSinceSignup >= 7) {
    const { data: hist } = await supabase.from('sessions').select('active_seconds').eq('outcome', 'completed').order('started_at').limit(200)
    state = calibrate(state, (hist ?? []).map((h) => Math.round((h.active_seconds ?? 0) / 60)), daysSinceSignup)
  }
  await supabase.from('ladder_state').update(fromLadder(state)).eq('owner_id', ladderRow!.owner_id)

  revalidatePath('/', 'layout')
  return {
    ok: true, outcome, activeMinutes: Math.round(seconds / 60), plannedMinutes: s.planned_minutes,
    predictedMinutes: s.predicted_minutes, mode, distractions, clean,
    ladderEvent: applied.event, rung: state.currentRung, cleanCount: state.cleanCount,
    breakMinutes: suggestedBreakMinutes(seconds),
  }
}

/** Session protocol "after" step (DESIGN §6.1). */
export async function reviewSession(input: {
  id: string; goalMet: 'yes' | 'partial' | 'no' | null; quality: number | null; reentryNote: string | null; taskDone: boolean
}): Promise<Result> {
  const p = z.object({
    id: uuid, goalMet: z.enum(['yes', 'partial', 'no']).nullable(), quality: z.number().int().min(1).max(5).nullable(),
    reentryNote: z.string().trim().max(300).nullable(), taskDone: z.boolean(),
  }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Invalid review.' }
  const { supabase, now } = await getViewer()
  const { data: s } = await supabase.from('sessions').select('task_id').eq('id', p.data.id).single()
  if (!s) return { ok: false, error: 'Session not found.' }
  await supabase.from('sessions').update({ goal_met: p.data.goalMet, quality: p.data.quality, reentry_note: p.data.reentryNote || null }).eq('id', p.data.id)
  await supabase.from('tasks').update({
    reentry_note: p.data.taskDone ? null : p.data.reentryNote || null,
    ...(p.data.taskDone && { status: 'done', completed_at: now.toISOString() }),
    last_touched_at: now.toISOString(),
  }).eq('id', s.task_id)
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function respondStepDown(accept: boolean): Promise<Result> {
  const { supabase, userId } = await getViewer()
  const { data: row } = await supabase.from('ladder_state').select('*').single()
  if (!row) return { ok: false, error: 'No ladder.' }
  const next = accept ? acceptStepDown(toLadder(row)) : dismissStepDown(toLadder(row))
  await supabase.from('ladder_state').update(fromLadder(next)).eq('owner_id', userId)
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function recordBreak(input: { afterSessionId: string; suggested: number; taken: boolean }): Promise<Result> {
  const p = z.object({ afterSessionId: uuid, suggested: z.number().int().min(1).max(60), taken: z.boolean() }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Invalid request.' }
  const { supabase } = await getViewer()
  await supabase.from('breaks').insert({ after_session_id: p.data.afterSessionId, suggested_minutes: p.data.suggested, taken: p.data.taken })
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Break taken from the Now card (no specific session): attach to the latest session today. */
export async function takeBreakNow(minutes: number): Promise<Result> {
  const { supabase } = await getViewer()
  const { data: last } = await supabase.from('sessions').select('id').not('ended_at', 'is', null).order('ended_at', { ascending: false }).limit(1).maybeSingle()
  if (!last) return { ok: true }
  return recordBreak({ afterSessionId: last.id, suggested: Math.min(60, Math.max(1, minutes)), taken: true })
}

/** Block Launcher: make sure a block has a task to focus on (goal-only blocks get one created). */
export async function ensureBlockTask(blockId: string): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  if (!uuid.safeParse(blockId).success) return { ok: false, error: 'Invalid block.' }
  const { supabase, today, now } = await getViewer()
  const { data: b } = await supabase.from('calendar_blocks').select('id, title, task_id, goal_id, type, if_then_text').eq('id', blockId).single()
  if (!b) return { ok: false, error: 'Block not found.' }
  if (b.task_id) return { ok: true, taskId: b.task_id }
  let projectId: string | null = null
  if (b.goal_id) {
    const { data: link } = await supabase.from('goal_projects').select('project_id').eq('goal_id', b.goal_id).limit(1).maybeSingle()
    projectId = link?.project_id ?? null
  }
  const firstStep = b.if_then_text?.split('→')[1]?.trim() || b.title
  const { data: t, error } = await supabase.from('tasks').insert({
    title: b.title, first_action: firstStep, status: 'today', planned_for: today, project_id: projectId,
    kind: b.type === 'speaking' ? 'speak' : 'work', first_planned_at: now.toISOString(),
  }).select('id').single()
  if (error || !t) return { ok: false, error: 'Could not prepare the block.' }
  await supabase.from('calendar_blocks').update({ task_id: t.id }).eq('id', b.id)
  return { ok: true, taskId: t.id }
}
