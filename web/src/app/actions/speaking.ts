'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getViewer } from '@/lib/data/viewer'
import { speechMetrics } from '@/domain/speaking/metrics'
import type { Result } from './tasks'

const DRILL = ['impromptu', 'structured', 'explain', 'summarize', 'rehearsal'] as const

const recSchema = z.object({
  id: z.string().uuid(),
  audioPath: z.string().max(200).nullable(),
  promptId: z.string().uuid().nullable(),
  promptText: z.string().trim().min(1).max(2000),
  drillType: z.enum(DRILL),
  framework: z.enum(['prep', 'star']).nullable(),
  parentId: z.string().uuid().nullable(),
  takeNumber: z.number().int().min(1).max(5),
  targetSeconds: z.number().int().min(15).max(1800),
  durationSeconds: z.number().int().min(1).max(3600),
  speakingSeconds: z.number().int().min(0).max(3600).nullable(),
  longPauses: z.number().int().min(0).max(999),
  transcript: z.string().max(20000),
  segments: z.array(z.object({ t: z.number(), text: z.string().max(2000) })).max(500),
  listened: z.literal(true),
  rating: z.object({
    clarity: z.number().int().min(1).max(5), structure: z.number().int().min(1).max(5), confidence: z.number().int().min(1).max(5),
    conciseness: z.number().int().min(1).max(5), engagement: z.number().int().min(1).max(5),
  }),
  guessedFillers: z.number().int().min(0).max(999),
  oneFix: z.string().trim().max(200).nullable(),
  blockId: z.string().uuid().nullable(),
  pitchVar: z.number().min(0).max(99).nullable().optional(),
  volumeVar: z.number().min(0).max(99).nullable().optional(),
})

/**
 * Save a take after listen-back + self-rating (DESIGN §7.2). Metrics are recomputed on the server
 * from the transcript so they can't drift from the rules.
 */
export async function saveRecording(input: z.input<typeof recSchema>): Promise<{ ok: true; isBaseline: boolean } | { ok: false; error: string }> {
  const p = recSchema.safeParse(input)
  if (!p.success) return { ok: false, error: 'Listen back and rate before saving.' }
  const d = p.data
  const { supabase, userId, settings } = await getViewer()
  if (d.audioPath && !d.audioPath.startsWith(`${userId}/`)) return { ok: false, error: 'Invalid audio path.' }

  const m = speechMetrics({
    transcript: d.transcript, durationSeconds: d.durationSeconds, speakingSeconds: d.speakingSeconds,
    longPauses: d.longPauses, targetSeconds: d.targetSeconds, fillers: settings.filler_words,
  })
  const { count } = await supabase.from('recordings').select('id', { count: 'exact', head: true }).eq('drill_type', d.drillType)
  const isBaseline = (count ?? 0) === 0 && (d.drillType === 'impromptu' || d.drillType === 'explain' || d.drillType === 'structured')

  const { error } = await supabase.from('recordings').insert({
    id: d.id, prompt_id: d.promptId, prompt_text: d.promptText, drill_type: d.drillType, framework: d.framework,
    parent_recording_id: d.parentId, take_number: d.takeNumber, target_seconds: d.targetSeconds,
    duration_seconds: d.durationSeconds, speaking_seconds: d.speakingSeconds, audio_path: d.audioPath,
    transcript: d.transcript || null, transcript_segments: d.segments, word_count: m.wordCount, wpm: m.wpm,
    filler_count: d.transcript ? m.fillerCount : null, fillers_per_min: d.transcript ? m.fillersPerMin : null,
    filler_breakdown: m.fillerBreakdown, long_pause_count: m.longPauses, hedges_per_min: d.transcript ? m.hedgesPerMin : null,
    repeats: m.repeats, vocab_variety: m.vocabVariety, time_on_target: m.timeOnTarget,
    listened: true, ...d.rating, guessed_fillers: d.guessedFillers, one_fix: d.oneFix,
    is_baseline: isBaseline, is_milestone: isBaseline, block_id: d.blockId,
    pitch_var: d.pitchVar ?? null, volume_var: d.volumeVar ?? null,
  })
  if (error) return { ok: false, error: 'Could not save the recording.' }
  revalidatePath('/speak')
  return { ok: true, isBaseline }
}

export async function setMilestone(id: string, value: boolean): Promise<Result> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'Invalid request.' }
  const { supabase } = await getViewer()
  const { error } = await supabase.from('recordings').update({ is_milestone: value }).eq('id', id)
  revalidatePath('/speak')
  return error ? { ok: false, error: 'Could not update.' } : { ok: true }
}

export async function deleteRecording(id: string): Promise<Result> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'Invalid request.' }
  const { supabase } = await getViewer()
  const { data: r } = await supabase.from('recordings').select('audio_path').eq('id', id).single()
  if (r?.audio_path) await supabase.storage.from('recordings').remove([r.audio_path])
  const { error } = await supabase.from('recordings').delete().eq('id', id)
  revalidatePath('/speak')
  return error ? { ok: false, error: 'Could not delete.' } : { ok: true }
}

export async function addPrompt(input: { drillType: string; text: string; framework: string | null; projectId: string | null }): Promise<Result> {
  const p = z.object({
    drillType: z.enum(DRILL), text: z.string().trim().min(3).max(2000),
    framework: z.enum(['prep', 'star']).nullable(), projectId: z.string().uuid().nullable(),
  }).safeParse(input)
  if (!p.success) return { ok: false, error: 'Write a prompt of at least a few words.' }
  const { supabase } = await getViewer()
  const { error } = await supabase.from('speaking_prompts').insert({
    drill_type: p.data.drillType, text: p.data.text, framework: p.data.framework, project_id: p.data.projectId, category: 'mine',
  })
  revalidatePath('/speak')
  return error ? { ok: false, error: 'Could not add the prompt.' } : { ok: true }
}

/** Short-lived signed URL for playback of the user's own audio. */
export async function audioUrl(path: string): Promise<string | null> {
  const { supabase, userId } = await getViewer()
  if (!path.startsWith(`${userId}/`)) return null
  const { data } = await supabase.storage.from('recordings').createSignedUrl(path, 600)
  return data?.signedUrl ?? null
}
