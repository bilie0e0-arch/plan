import { describe, expect, it } from 'vitest'
import { acceptStepDown, applySession, calibrate, type LadderState } from './ladder'
import { classifyOutcome } from './session'

const base: LadderState = { currentRung: 25, cleanCount: 0, consecutiveMisses: 0, suggestDown: false, calibrated: false }
const clean = { mode: 'ladder', plannedMinutes: 25, outcome: 'completed' as const, distractions: 0 }

describe('focus ladder', () => {
  it('climbs after three clean sessions at the current rung', () => {
    let s = base
    s = applySession(s, clean).state
    s = applySession(s, clean).state
    const r = applySession(s, clean)
    expect(r.event).toBe('climbed')
    expect(r.state.currentRung).toBe(30)
    expect(r.state.cleanCount).toBe(0)
  })
  it('suggests (never forces) one rung down after two misses', () => {
    const miss = { ...clean, outcome: 'stopped_early' as const }
    const r = applySession(applySession(base, miss).state, miss)
    expect(r.event).toBe('suggest_down')
    expect(r.state.currentRung).toBe(25)
    expect(acceptStepDown(r.state).currentRung).toBe(20)
  })
  it('ignores non-ladder sessions and counts >1 distraction as not clean', () => {
    expect(applySession(base, { ...clean, mode: 'timebox' }).state).toBe(base)
    expect(applySession(base, { ...clean, distractions: 2 }).state.cleanCount).toBe(0)
  })
  it('calibrates down (never up) after the baseline week', () => {
    expect(calibrate(base, [18, 22, 19], 7).currentRung).toBe(15)
    expect(calibrate(base, [60, 60, 60], 7).currentRung).toBe(25)
    expect(calibrate(base, [10, 10, 10], 3)).toBe(base)
  })
  it('classifies outcomes', () => {
    expect(classifyOutcome('ladder', 25, 25 * 60, false)).toBe('completed')
    expect(classifyOutcome('ladder', 25, 10 * 60, false)).toBe('stopped_early')
    expect(classifyOutcome('free', null, 60, false)).toBe('abandoned')
    expect(classifyOutcome('starter', 5, 5 * 60, false)).toBe('completed')
  })
})
