/** Commitment Ladder (DESIGN §9.5) and confidence calibration (Brier score). */

export interface GoalWeek { committed: number; actual: number } // minutes, oldest → newest, completed weeks only

export interface LadderSuggestion { kind: 'down' | 'up'; minutes: number; text: string }

const roundTo = (m: number, step: number) => Math.round(m / step) * step
const hours = (m: number) => `${Math.round((m / 60) * 10) / 10}h`

/**
 * Down: actual < 75% of committed for 3 consecutive weeks → commit to what you deliver + 30 min.
 * Up: ≥ 90% delivered for 2 consecutive weeks → +10%.
 */
export function commitmentSuggestion(goal: string, weeks: GoalWeek[], currentMinutes: number): LadderSuggestion | null {
  const last3 = weeks.slice(-3)
  if (last3.length === 3 && last3.every((w) => w.committed > 0 && w.actual < 0.75 * w.committed)) {
    const avg = last3.reduce((a, w) => a + w.actual, 0) / 3
    const minutes = Math.max(30, roundTo(avg, 30) + 30)
    if (minutes < currentMinutes) {
      return { kind: 'down', minutes, text: `You’ve delivered ~${hours(avg)}/week on ${goal}. Commit to ${hours(minutes)} and keep it?` }
    }
  }
  const last2 = weeks.slice(-2)
  if (last2.length === 2 && last2.every((w) => w.committed > 0 && w.actual >= 0.9 * w.committed) && currentMinutes > 0) {
    const minutes = Math.max(currentMinutes + 15, roundTo(currentMinutes * 1.1, 15))
    return { kind: 'up', minutes, text: `Two kept weeks on ${goal}. Ready for ${hours(minutes)} (+10%)?` }
  }
  return null
}

/** A week counts as delivered when ≥ 90% of the committed minutes happened. */
export const deliveredWeek = (w: GoalWeek) => w.committed > 0 && w.actual >= 0.9 * w.committed

export interface Forecast { p: number; hit: boolean } // p in 0..1

/** Brier score (0 = perfect, 0.25 = coin flip) and over-confidence in points. Needs ≥ 4 resolved forecasts. */
export function calibration(fs: Forecast[]): { brier: number; overconfidence: number; n: number } | null {
  if (fs.length < 4) return null
  const brier = fs.reduce((a, f) => a + (f.p - (f.hit ? 1 : 0)) ** 2, 0) / fs.length
  const meanP = fs.reduce((a, f) => a + f.p, 0) / fs.length
  const hitRate = fs.filter((f) => f.hit).length / fs.length
  return { brier: Math.round(brier * 1000) / 1000, overconfidence: Math.round((meanP - hitRate) * 100), n: fs.length }
}
