/** Calendar & commitment rules (DESIGN §9.3–9.5, §10.6–10.7). Pure functions. */

const MIN = 60_000

export type BlockOutcome = 'kept' | 'shortened' | 'moved' | 'released' | 'missed'

export const OUTCOME_SCORE: Record<BlockOutcome, number | null> = {
  kept: 1, shortened: 0.5, moved: null, released: null, missed: 0,
}

export const RELEASE_LEAD_MS = 2 * 60 * MIN
export const KEPT_LATE_MINUTES = 10
export const FINALIZE_AFTER_END_MINUTES = 15

export interface OutcomeInput {
  committedStart: Date
  committedMinutes: number
  currentStart: Date
  currentEnd: Date
  moved: boolean
  cancelled: { at: Date; reason: string | null } | null
  sessions: { startedAt: Date; activeSeconds: number }[]
  now: Date
}

export interface OutcomeResult {
  outcome: BlockOutcome
  score: number | null // null = excluded from Reliability (released)
  actualMinutes: number
  minutesLate: number | null
}

/** Returns null while the block is not yet final (before end + 15 min, unless cancelled). */
export function blockOutcome(b: OutcomeInput): OutcomeResult | null {
  if (b.cancelled) {
    const early = b.committedStart.getTime() - b.cancelled.at.getTime() >= RELEASE_LEAD_MS && !!b.cancelled.reason?.trim()
    return early
      ? { outcome: 'released', score: null, actualMinutes: 0, minutesLate: null }
      : { outcome: 'missed', score: 0, actualMinutes: 0, minutesLate: null }
  }
  if (b.now.getTime() < b.currentEnd.getTime() + FINALIZE_AFTER_END_MINUTES * MIN) return null

  const planned = Math.max(1, Math.round((b.currentEnd.getTime() - b.currentStart.getTime()) / MIN))
  const actualMinutes = Math.round(b.sessions.reduce((a, s) => a + s.activeSeconds, 0) / 60)
  const first = b.sessions.length ? Math.min(...b.sessions.map((s) => s.startedAt.getTime())) : null
  const minutesLate = first === null ? null : Math.max(0, Math.round((first - b.currentStart.getTime()) / MIN))

  let base: BlockOutcome
  if (first !== null && minutesLate! <= KEPT_LATE_MINUTES && actualMinutes >= 0.8 * planned) base = 'kept'
  else if (actualMinutes >= 0.3 * planned) base = 'shortened'
  else base = 'missed'

  if (b.moved) {
    const s = OUTCOME_SCORE[base]!
    return { outcome: 'moved', score: Math.round(0.75 * s * 1000) / 1000, actualMinutes, minutesLate }
  }
  return { outcome: base, score: OUTCOME_SCORE[base], actualMinutes, minutesLate }
}

/** Capacity rule: committed blocks ≤ 60% of free hours in the waking window minus fixed events. */
export const CAPACITY_RATIO = 0.6

export function freeMinutesInWindow(windowStart: Date, windowEnd: Date, fixed: { start: Date; end: Date }[]): number {
  const total = (windowEnd.getTime() - windowStart.getTime()) / MIN
  const busy = mergeIntervals(fixed.map((f) => ({
    start: Math.max(f.start.getTime(), windowStart.getTime()),
    end: Math.min(f.end.getTime(), windowEnd.getTime()),
  })).filter((f) => f.end > f.start)).reduce((a, f) => a + (f.end - f.start) / MIN, 0)
  return Math.max(0, Math.round(total - busy))
}

export function mergeIntervals(xs: { start: number; end: number }[]): { start: number; end: number }[] {
  const s = [...xs].sort((a, b) => a.start - b.start)
  const out: { start: number; end: number }[] = []
  for (const x of s) {
    const last = out[out.length - 1]
    if (last && x.start <= last.end) last.end = Math.max(last.end, x.end)
    else out.push({ ...x })
  }
  return out
}

export function capacityState(plannedMinutes: number, freeMinutes: number): { ratio: number; state: 'ok' | 'over' } {
  const ratio = freeMinutes > 0 ? plannedMinutes / freeMinutes : plannedMinutes > 0 ? Infinity : 0
  return { ratio, state: ratio <= CAPACITY_RATIO ? 'ok' : 'over' }
}

/** Start-escalation schedule (DESIGN §10.7): heads-up −5, T0, +5 (push), +15 (in-app rescue). */
export type EscalationStep = 'heads_up' | 't0' | 'plus5' | 'plus15'

export function dueEscalation(start: Date, now: Date, started: boolean): EscalationStep | null {
  if (started) return null
  const m = (now.getTime() - start.getTime()) / MIN
  if (m >= -5 && m < -4) return 'heads_up'
  if (m >= 0 && m < 1) return 't0'
  if (m >= 5 && m < 6) return 'plus5'
  if (m >= 15 && m < 16) return 'plus15'
  return null
}

/** Quiet hours may wrap midnight (e.g. 22 → 7). */
export function inQuietHours(localHour: number, quietStart: number, quietEnd: number): boolean {
  if (quietStart === quietEnd) return false
  return quietStart < quietEnd ? localHour >= quietStart && localHour < quietEnd : localHour >= quietStart || localHour < quietEnd
}

/** Gap before the next block, in minutes, if nothing is active now. */
export function gapBeforeNext(now: Date, blocks: { start: Date; end: Date }[]): number | null {
  if (blocks.some((b) => b.start <= now && b.end > now)) return null
  const next = blocks.filter((b) => b.start > now).sort((a, b) => a.start.getTime() - b.start.getTime())[0]
  return next ? Math.round((next.start.getTime() - now.getTime()) / MIN) : null
}

/** Auto-generated if-then line for a block (DESIGN §9.3). */
export function ifThenLine(start: Date, timeZone: string, firstStep: string): string {
  const t = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(start)
  return `At ${t} → ${firstStep}`
}

/** Reliability (S8): weighted kept-rate, released excluded. */
export function reliability(outcomes: { score: number | null }[]): number | null {
  const scored = outcomes.filter((o) => o.score !== null)
  if (scored.length < 5) return null
  return Math.round((scored.reduce((a, o) => a + (o.score ?? 0), 0) / scored.length) * 100)
}
