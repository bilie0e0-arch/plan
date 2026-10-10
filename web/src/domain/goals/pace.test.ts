import { describe, expect, it } from 'vitest'
import { goalPace } from './pace'

const now = new Date('2026-10-12T12:00:00Z')
const weeksAgo = (w: number) => new Date(now.getTime() - w * 7 * 86_400_000)
const weeksAhead = (w: number) => new Date(now.getTime() + w * 7 * 86_400_000)

describe('goal pace', () => {
  it('process goals are judged by time debt', () => {
    const base = { type: 'process' as const, targetValue: null, currentValue: 0, deadline: null, activatedAt: weeksAgo(2), weeklyCommitmentMinutes: 240, progressHistory: [], now }
    expect(goalPace({ ...base, spentMinutes: 480 }).status).toBe('on_pace')
    expect(goalPace({ ...base, spentMinutes: 200 })).toMatchObject({ status: 'at_risk', timeDebtMinutes: 280 })
  })
  it('outcome goals forecast finish from the actual rate', () => {
    const g = {
      type: 'outcome' as const, targetValue: 100, currentValue: 40, deadline: weeksAhead(6), activatedAt: weeksAgo(4),
      weeklyCommitmentMinutes: 300, spentMinutes: 1200, now,
      progressHistory: [{ at: weeksAgo(4), value: 0 }, { at: weeksAgo(2), value: 20 }],
    }
    const p = goalPace(g) // 10/week, 60 left → 6 weeks → on pace
    expect(p.actualPerWeek).toBe(10)
    expect(p.status).toBe('on_pace')
    expect(goalPace({ ...g, deadline: weeksAhead(2) }).status).toBe('at_risk')
    expect(goalPace({ ...g, progressHistory: [] }).status).toBe('unknown')
  })
})
