/** Session rules shared by server actions and the focus UI (DESIGN §6). */

export type TimerMode = 'ladder' | 'blind' | 'starter' | 'timebox' | 'free'
export type Outcome = 'completed' | 'stopped_early' | 'abandoned'

/** Plain names a child understands (UI v0.6). Internals keep the original mode ids. */
export const MODE_LABEL: Record<TimerMode, string> = {
  ladder: 'Grow my focus',
  blind: 'Guess the time',
  starter: 'Just 5 minutes',
  timebox: 'Set time',
  free: 'Open timer',
}

export const MODE_HINT: Record<TimerMode, string> = {
  ladder: 'Starts at your level and grows when you stay focused',
  blind: 'Guess first — the clock stays hidden, then see how close you were',
  starter: 'For things you keep putting off — just begin',
  timebox: 'A fixed block of time',
  free: 'No limit — stop when you’re done',
}

export const MODE_EMOJI: Record<TimerMode, string> = { ladder: '🌱', blind: '🔮', starter: '🚀', timebox: '⏱️', free: '♾️' }

export const STARTER_MINUTES = 5
export const MIN_COUNTED_SECONDS = 120

export function activeSeconds(
  startedAt: Date,
  endAt: Date,
  pausedSeconds: number,
  pausedAt: Date | null,
): number {
  const end = pausedAt && pausedAt < endAt ? pausedAt : endAt
  return Math.max(0, Math.round((end.getTime() - startedAt.getTime()) / 1000) - pausedSeconds)
}

export function classifyOutcome(
  mode: TimerMode,
  plannedMinutes: number | null,
  seconds: number,
  discarded: boolean,
): Outcome {
  if (discarded || seconds < MIN_COUNTED_SECONDS) return 'abandoned'
  if (mode === 'starter') return seconds >= STARTER_MINUTES * 60 * 0.9 ? 'completed' : 'stopped_early'
  if (plannedMinutes && (mode === 'ladder' || mode === 'timebox') && seconds < plannedMinutes * 60 * 0.9) {
    return 'stopped_early'
  }
  return 'completed'
}

export function isClean(outcome: Outcome, distractions: number): boolean {
  return outcome === 'completed' && distractions <= 1
}

/** Break ≈ session ÷ 5, between 3 and 20 minutes. */
export function suggestedBreakMinutes(seconds: number): number {
  return Math.min(20, Math.max(3, Math.round(seconds / 60 / 5)))
}

export interface ModeTaskInput {
  energy: 'deep' | 'shallow' | 'admin' | null
  estimateMinutes: number | null
  deferralCount: number
  ageDays: number
}

/**
 * Suggested timer mode (DESIGN §6.3). `blindDue` is true for every third estimated task
 * (or always during an Estimation drill). A Starting drill offers Starter after one deferral.
 */
export function suggestMode(t: ModeTaskInput, blindDue: boolean, starterAfterDeferrals = 2): TimerMode {
  if (t.deferralCount >= starterAfterDeferrals || t.ageDays >= 7) return 'starter'
  if (t.estimateMinutes && blindDue) return 'blind'
  if (t.energy === 'shallow' || t.energy === 'admin') return 'timebox'
  // You said how long it takes and didn't mark it deep work: respect your number (UI v0.6).
  if (t.energy === null && t.estimateMinutes) return 'timebox'
  return 'ladder'
}

export function plannedMinutesFor(mode: TimerMode, rung: number, estimate: number | null): number | null {
  switch (mode) {
    case 'ladder': return rung
    case 'timebox': return estimate ?? 25
    case 'starter': return STARTER_MINUTES
    default: return null
  }
}
