/** Goal pace engine (DESIGN §9.2). Pure: all inputs passed in, dates as day keys or Date. */

export type GoalType = 'outcome' | 'learning' | 'process'
export type PaceStatus = 'ahead' | 'on_pace' | 'behind' | 'at_risk' | 'unknown'

const DAY = 86_400_000

export interface PaceInput {
  type: GoalType
  targetValue: number | null
  currentValue: number
  deadline: Date | null
  activatedAt: Date | null
  weeklyCommitmentMinutes: number
  spentMinutes: number // total focus minutes attributed since activation
  progressHistory: { at: Date; value: number }[] // value snapshots (for actual rate)
  now: Date
}

export interface Pace {
  timeDebtMinutes: number
  requiredPerWeek: number | null
  actualPerWeek: number | null
  forecastFinish: Date | null
  status: PaceStatus
  progressPct: number | null
}

export function goalPace(g: PaceInput): Pace {
  const weeksActive = g.activatedAt ? Math.max(1 / 7, (g.now.getTime() - g.activatedAt.getTime()) / (7 * DAY)) : 0
  const committedSoFar = g.weeklyCommitmentMinutes * weeksActive
  const timeDebtMinutes = Math.round(committedSoFar - g.spentMinutes)

  // Process goals: the behaviour is the goal → judge by time debt.
  if (g.type === 'process' || g.targetValue == null || g.targetValue <= 0) {
    const weeksOfDebt = g.weeklyCommitmentMinutes > 0 ? timeDebtMinutes / g.weeklyCommitmentMinutes : 0
    const status: PaceStatus = !g.activatedAt ? 'unknown' : weeksOfDebt <= -0.25 ? 'ahead' : weeksOfDebt <= 0.25 ? 'on_pace' : weeksOfDebt <= 1 ? 'behind' : 'at_risk'
    return { timeDebtMinutes, requiredPerWeek: null, actualPerWeek: null, forecastFinish: null, status, progressPct: null }
  }

  const remaining = Math.max(0, g.targetValue - g.currentValue)
  const progressPct = Math.min(100, Math.round((g.currentValue / g.targetValue) * 100))
  const weeksLeft = g.deadline ? Math.max(1 / 7, (g.deadline.getTime() - g.now.getTime()) / (7 * DAY)) : null
  const requiredPerWeek = weeksLeft ? remaining / weeksLeft : null

  // Actual rate: progress since the earliest snapshot (activation), at least one day ago.
  const hist = [...g.progressHistory].sort((a, b) => a.at.getTime() - b.at.getTime())
  let actualPerWeek: number | null = null
  if (hist.length >= 1 && g.now.getTime() - hist[0]!.at.getTime() >= DAY) {
    const first = hist[0]!
    const weeks = Math.max(1 / 7, (g.now.getTime() - first.at.getTime()) / (7 * DAY))
    actualPerWeek = (g.currentValue - first.value) / weeks
  }

  if (remaining === 0) return { timeDebtMinutes, requiredPerWeek: 0, actualPerWeek, forecastFinish: g.now, status: 'ahead', progressPct }
  if (!actualPerWeek || actualPerWeek <= 0 || !g.deadline) {
    return { timeDebtMinutes, requiredPerWeek, actualPerWeek, forecastFinish: null, status: 'unknown', progressPct }
  }
  const forecastFinish = new Date(g.now.getTime() + (remaining / actualPerWeek) * 7 * DAY)
  const lateDays = (forecastFinish.getTime() - g.deadline.getTime()) / DAY
  const debtWeeks = g.weeklyCommitmentMinutes > 0 ? timeDebtMinutes / g.weeklyCommitmentMinutes : 0
  const status: PaceStatus =
    lateDays > 21 || debtWeeks > 2 ? 'at_risk' : lateDays > 7 ? 'behind' : lateDays < -7 ? 'ahead' : 'on_pace'
  return { timeDebtMinutes, requiredPerWeek, actualPerWeek, forecastFinish, status, progressPct }
}

export const PACE_LABEL: Record<PaceStatus, string> = {
  ahead: 'Ahead', on_pace: 'On pace', behind: 'Behind', at_risk: 'At risk', unknown: 'Not enough data',
}
