import { describe, expect, it } from 'vitest'
import { blockOutcome, capacityState, dueEscalation, freeMinutesInWindow, gapBeforeNext, inQuietHours, reliability } from './blocks'

const t = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 12, h, m))
const base = { committedStart: t(7), committedMinutes: 50, currentStart: t(7), currentEnd: t(7, 50), moved: false, cancelled: null, now: t(9) }

describe('block outcomes (commitment ledger)', () => {
  it('kept: started ≤10 min late and ≥80% of the time', () => {
    expect(blockOutcome({ ...base, sessions: [{ startedAt: t(7, 5), activeSeconds: 42 * 60 }] })).toMatchObject({ outcome: 'kept', score: 1, minutesLate: 5 })
  })
  it('shortened between 30% and 80%; missed below 30% or not started', () => {
    expect(blockOutcome({ ...base, sessions: [{ startedAt: t(7), activeSeconds: 20 * 60 }] })?.outcome).toBe('shortened')
    expect(blockOutcome({ ...base, sessions: [] })).toMatchObject({ outcome: 'missed', score: 0 })
  })
  it('released only when cancelled ≥2h ahead with a reason; otherwise missed', () => {
    expect(blockOutcome({ ...base, sessions: [], cancelled: { at: t(4), reason: 'Client call moved' } })).toMatchObject({ outcome: 'released', score: null })
    expect(blockOutcome({ ...base, sessions: [], cancelled: { at: t(6, 30), reason: 'late' } })?.outcome).toBe('missed')
    expect(blockOutcome({ ...base, sessions: [], cancelled: { at: t(4), reason: '' } })?.outcome).toBe('missed')
  })
  it('moved blocks score 0.75 × their result; not final until end + 15 min', () => {
    expect(blockOutcome({ ...base, moved: true, sessions: [{ startedAt: t(7), activeSeconds: 50 * 60 }] })).toMatchObject({ outcome: 'moved', score: 0.75 })
    expect(blockOutcome({ ...base, now: t(7, 55), sessions: [] })).toBeNull()
  })
  it('reliability excludes released blocks and needs 5 scored', () => {
    expect(reliability([{ score: 1 }, { score: 1 }, { score: 0 }, { score: 0.5 }, { score: 1 }, { score: null }])).toBe(70)
    expect(reliability([{ score: 1 }])).toBeNull()
  })
})

describe('capacity, escalation, quiet hours, gaps', () => {
  it('subtracts merged fixed events from the window', () => {
    const free = freeMinutesInWindow(t(7), t(22), [{ start: t(10), end: t(12) }, { start: t(11), end: t(13) }])
    expect(free).toBe(15 * 60 - 180)
    expect(capacityState(500, 1000).state).toBe('ok')
    expect(capacityState(700, 1000).state).toBe('over')
  })
  it('escalates at -5, 0, +5, +15 only while not started', () => {
    expect(dueEscalation(t(7), t(6, 55), false)).toBe('heads_up')
    expect(dueEscalation(t(7), t(7, 5), false)).toBe('plus5')
    expect(dueEscalation(t(7), t(7, 15), false)).toBe('plus15')
    expect(dueEscalation(t(7), t(7, 5), true)).toBeNull()
    expect(dueEscalation(t(7), t(7, 30), false)).toBeNull()
  })
  it('quiet hours wrap midnight; gaps only when nothing is active', () => {
    expect(inQuietHours(23, 22, 7)).toBe(true)
    expect(inQuietHours(6, 22, 7)).toBe(true)
    expect(inQuietHours(12, 22, 7)).toBe(false)
    expect(gapBeforeNext(t(9), [{ start: t(9, 20), end: t(10) }])).toBe(20)
    expect(gapBeforeNext(t(9, 30), [{ start: t(9, 20), end: t(10) }])).toBeNull()
  })
})
