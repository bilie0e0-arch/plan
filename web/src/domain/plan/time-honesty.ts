/** Planning-fallacy correction, day-fit and attention budget (DESIGN F8, F15, F16). */

export const MIN_SAMPLES = 10
export const DEFAULT_UNESTIMATED_MINUTES = 30

export interface RatioSample {
  ratio: number // actual / estimate
  projectId: string | null
  energy: string | null
}

export interface Multiplier {
  value: number
  basis: 'project' | 'energy' | 'overall' | 'none'
  samples: number
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

const clamp = (v: number) => Math.min(3, Math.max(0.5, Math.round(v * 100) / 100))

/** Most specific multiplier with ≥ 10 samples: project → energy → overall → 1.0. */
export function personalMultiplier(samples: RatioSample[], projectId: string | null, energy: string | null): Multiplier {
  const byProject = projectId ? samples.filter((s) => s.projectId === projectId) : []
  if (byProject.length >= MIN_SAMPLES) return { value: clamp(median(byProject.map((s) => s.ratio))), basis: 'project', samples: byProject.length }
  const byEnergy = energy ? samples.filter((s) => s.energy === energy) : []
  if (byEnergy.length >= MIN_SAMPLES) return { value: clamp(median(byEnergy.map((s) => s.ratio))), basis: 'energy', samples: byEnergy.length }
  if (samples.length >= MIN_SAMPLES) return { value: clamp(median(samples.map((s) => s.ratio))), basis: 'overall', samples: samples.length }
  return { value: 1, basis: 'none', samples: samples.length }
}

export interface FitItem {
  estimateMinutes: number | null
  multiplier: number
}

export interface DayFit {
  rawMinutes: number
  adjustedMinutes: number
  availableMinutes: number
  unestimated: number
  ratio: number
  state: 'ok' | 'tight' | 'over'
}

export function dayFit(items: FitItem[], availableMinutes: number): DayFit {
  let raw = 0
  let adjusted = 0
  let unestimated = 0
  for (const i of items) {
    if (i.estimateMinutes == null) {
      unestimated++
      raw += DEFAULT_UNESTIMATED_MINUTES
      adjusted += DEFAULT_UNESTIMATED_MINUTES
    } else {
      raw += i.estimateMinutes
      adjusted += i.estimateMinutes * i.multiplier
    }
  }
  adjusted = Math.round(adjusted)
  const ratio = availableMinutes > 0 ? adjusted / availableMinutes : adjusted > 0 ? Infinity : 0
  return {
    rawMinutes: raw,
    adjustedMinutes: adjusted,
    availableMinutes,
    unestimated,
    ratio,
    state: ratio <= 0.9 ? 'ok' : ratio <= 1.1 ? 'tight' : 'over',
  }
}

export interface Drift {
  pct: number // actual / weekly budget
  pace: number // actual / expected-by-today
  underServed: boolean
}

/** dayIndex: 0 = Monday … 6 = Sunday. Under-served = below half of expected pace from Thursday on. */
export function attentionDrift(budgetMinutes: number, actualMinutes: number, dayIndex: number): Drift | null {
  if (budgetMinutes <= 0) return null
  const expected = (budgetMinutes * (dayIndex + 1)) / 7
  const pace = expected > 0 ? actualMinutes / expected : 1
  return { pct: actualMinutes / budgetMinutes, pace, underServed: dayIndex >= 3 && pace < 0.5 }
}
