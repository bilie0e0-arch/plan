/** Speech metrics from a transcript + audio timing (DESIGN §7.4). Pure; runs in browser and server. */

export const DEFAULT_FILLERS = ['um', 'uh', 'like', 'basically', 'actually', 'you know', 'sort of', 'kind of', 'i mean', 'right', 'so', 'literally']
export const HEDGES = ['i think', 'maybe', 'probably', 'just', 'i guess', 'perhaps', 'kind of', 'sort of']

export interface SpeechInput {
  transcript: string
  durationSeconds: number
  speakingSeconds: number | null // from audio energy; null if unavailable
  longPauses: number
  targetSeconds: number
  fillers?: string[]
}

export interface SpeechMetrics {
  wordCount: number
  wpm: number | null
  fillerCount: number
  fillersPerMin: number
  fillerBreakdown: Record<string, number>
  hedgesPerMin: number
  repeats: number
  vocabVariety: number | null
  timeOnTarget: boolean
  longPauses: number
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, ' ').split(/\s+/).filter(Boolean)
}

/** Counts phrase occurrences (multi-word phrases matched on word boundaries). */
function countPhrases(words: string[], phrases: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  const sorted = [...phrases].sort((a, b) => b.split(' ').length - a.split(' ').length)
  const used = new Array(words.length).fill(false)
  for (const p of sorted) {
    const parts = p.toLowerCase().split(' ')
    for (let i = 0; i + parts.length <= words.length; i++) {
      if (parts.every((w, k) => words[i + k] === w && !used[i + k])) {
        out[p] = (out[p] ?? 0) + 1
        for (let k = 0; k < parts.length; k++) used[i + k] = true
      }
    }
  }
  return out
}

/** Moving-average type-token ratio over 50-word windows (robust to length). */
function mattr(words: string[], w = 50): number | null {
  if (words.length < 20) return null
  if (words.length <= w) return new Set(words).size / words.length
  let sum = 0
  let n = 0
  for (let i = 0; i + w <= words.length; i++) {
    sum += new Set(words.slice(i, i + w)).size / w
    n++
  }
  return sum / n
}

export function speechMetrics(s: SpeechInput): SpeechMetrics {
  const words = tokenize(s.transcript)
  const minutes = Math.max(s.durationSeconds, 1) / 60
  const speakingMinutes = (s.speakingSeconds ?? s.durationSeconds) / 60
  const breakdown = countPhrases(words, s.fillers ?? DEFAULT_FILLERS)
  const fillerCount = Object.values(breakdown).reduce((a, b) => a + b, 0)
  const hedges = Object.values(countPhrases(words, HEDGES)).reduce((a, b) => a + b, 0)
  let repeats = 0
  for (let i = 1; i < words.length; i++) if (words[i] === words[i - 1]) repeats++
  const v = mattr(words)
  return {
    wordCount: words.length,
    wpm: words.length >= 10 && speakingMinutes > 0 ? Math.round(words.length / speakingMinutes) : null,
    fillerCount,
    fillersPerMin: Math.round((fillerCount / minutes) * 10) / 10,
    fillerBreakdown: breakdown,
    hedgesPerMin: Math.round((hedges / minutes) * 10) / 10,
    repeats,
    vocabVariety: v === null ? null : Math.round(v * 1000) / 1000,
    timeOnTarget: Math.abs(s.durationSeconds - s.targetSeconds) <= s.targetSeconds * 0.15,
    longPauses: s.longPauses,
  }
}

/**
 * Pause detection from per-frame loudness (RMS) samples taken every `frameMs`.
 * Speaking time = span from first to last speech frame minus long pauses (silence ≥ 3 s).
 */
export function analyzeLoudness(rms: number[], frameMs: number, threshold = 0.02): { speakingSeconds: number; longPauses: number } {
  const first = rms.findIndex((r) => r >= threshold)
  if (first === -1) return { speakingSeconds: 0, longPauses: 0 }
  let last = first
  for (let i = rms.length - 1; i >= first; i--) if (rms[i]! >= threshold) { last = i; break }
  const minLongFrames = Math.ceil(3000 / frameMs)
  let longPauses = 0
  let longFrames = 0
  let run = 0
  for (let i = first; i <= last; i++) {
    if (rms[i]! < threshold) run++
    else {
      if (run >= minLongFrames) { longPauses++; longFrames += run }
      run = 0
    }
  }
  return { speakingSeconds: Math.round(((last - first + 1 - longFrames) * frameMs) / 1000), longPauses }
}

export const DRILLS = {
  impromptu: { label: 'Impromptu', prep: 10, target: 75, blurb: 'Surprise prompt. Think on your feet.' },
  structured: { label: 'Structured Answer', prep: 30, target: 105, blurb: 'PREP or STAR — interview-style.' },
  explain: { label: 'Explain-It', prep: 30, target: 60, blurb: 'Teach a concept to a smart beginner.' },
  summarize: { label: 'Summarize', prep: 0, target: 60, blurb: 'Read, then sum it up in a minute.' },
  rehearsal: { label: 'Rehearsal', prep: 0, target: 180, blurb: 'Practise a real talk; compare takes.' },
} as const
export type DrillType = keyof typeof DRILLS

export const FRAMEWORK_HINT = {
  prep: 'Point → Reason → Example → Point',
  star: 'Situation → Task → Action → Result',
} as const
