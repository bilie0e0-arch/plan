/** Focus Ladder: progressive session length based on clean completions (DESIGN §6.2 Mode 1). */

export const RUNGS = [15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90] as const
export const CLIMB_AFTER_CLEAN = 3
export const STEP_DOWN_AFTER_MISSES = 2

export interface LadderState {
  currentRung: number
  cleanCount: number
  consecutiveMisses: number
  suggestDown: boolean
  calibrated: boolean
}

export type LadderEvent = 'climbed' | 'suggest_down' | null

export interface LadderSessionInput {
  mode: string
  plannedMinutes: number | null
  outcome: 'completed' | 'stopped_early' | 'abandoned'
  distractions: number
}

export function nextRung(r: number): number {
  return RUNGS.find((x) => x > r) ?? RUNGS[RUNGS.length - 1]!
}
export function prevRung(r: number): number {
  return [...RUNGS].reverse().find((x) => x < r) ?? RUNGS[0]
}

export function applySession(state: LadderState, s: LadderSessionInput): { state: LadderState; event: LadderEvent } {
  if (s.mode !== 'ladder') return { state, event: null }
  const clean = s.outcome === 'completed' && s.distractions <= 1

  if (clean && s.plannedMinutes === state.currentRung) {
    const cleanCount = state.cleanCount + 1
    if (cleanCount >= CLIMB_AFTER_CLEAN && state.currentRung < RUNGS[RUNGS.length - 1]!) {
      return {
        state: { ...state, currentRung: nextRung(state.currentRung), cleanCount: 0, consecutiveMisses: 0, suggestDown: false },
        event: 'climbed',
      }
    }
    return { state: { ...state, cleanCount, consecutiveMisses: 0, suggestDown: false }, event: null }
  }

  if (s.outcome === 'completed') return { state: { ...state, consecutiveMisses: 0 }, event: null }

  const consecutiveMisses = state.consecutiveMisses + 1
  if (consecutiveMisses >= STEP_DOWN_AFTER_MISSES && state.currentRung > RUNGS[0]) {
    return { state: { ...state, consecutiveMisses, suggestDown: true }, event: 'suggest_down' }
  }
  return { state: { ...state, consecutiveMisses }, event: null }
}

/** User accepts "try one rung lower". Never automatic. */
export function acceptStepDown(state: LadderState): LadderState {
  return { ...state, currentRung: prevRung(state.currentRung), cleanCount: 0, consecutiveMisses: 0, suggestDown: false }
}
export function dismissStepDown(state: LadderState): LadderState {
  return { ...state, consecutiveMisses: 0, suggestDown: false }
}

/**
 * After the baseline week: if the user's median completed session is shorter than the start rung,
 * start lower (never higher).
 */
export function calibrate(state: LadderState, completedMinutes: number[], daysSinceSignup: number): LadderState {
  if (state.calibrated || daysSinceSignup < 7 || completedMinutes.length < 3) return state
  const sorted = [...completedMinutes].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]!
  const fit = [...RUNGS].reverse().find((r) => r <= median) ?? RUNGS[0]
  return { ...state, currentRung: Math.min(state.currentRung, fit), calibrated: true }
}
