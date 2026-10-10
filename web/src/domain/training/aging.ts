/** Aging decision queue (DESIGN F20, §13.11): untouched tasks come back for a decision. */

const DAY = 86_400_000
export const AGING_STATUSES = ['inbox', 'backlog', 'today', 'evening'] as const

export function ageDays(lastTouchedAt: Date, now: Date): number {
  return Math.floor((now.getTime() - lastTouchedAt.getTime()) / DAY)
}

export function isAged(t: { status: string; lastTouchedAt: Date }, now: Date, agingDays: number): boolean {
  return (AGING_STATUSES as readonly string[]).includes(t.status) && ageDays(t.lastTouchedAt, now) >= agingDays
}
