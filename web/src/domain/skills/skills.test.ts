import { describe, expect, it } from 'vitest'
import { anchorsFromBaseline, bandFor, computeSkills, guideLevel, type SessionRow } from './skills'

const now = new Date('2026-10-30T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)
const session = (d: number, planned: number, clean = true, goal: SessionRow['goalMet'] = 'yes'): SessionRow => ({
  startedAt: daysAgo(d), mode: 'ladder', plannedMinutes: planned, activeSeconds: planned * 60,
  outcome: clean ? 'completed' : 'stopped_early', isClean: clean, goalMet: goal,
})

describe('skills', () => {
  it('bands respect direction (higher vs lower is better)', () => {
    expect(bandFor('S1', 55)).toBe('strong')
    expect(bandFor('S1', 20)).toBe('developing')
    expect(bandFor('S2', 1.5)).toBe('strong')
    expect(bandFor('S2', 6)).toBe('developing')
  })
  it('focus capacity = longest length with ≥3 sessions at ≥80% clean', () => {
    const sessions = [1, 2, 3].map((d) => session(d, 35)).concat([1, 2].map((d) => session(d, 50)))
    const s1 = computeSkills({ sessions, distractions: [], estimates: [], starts: [], days: [] }, now)[0]!
    expect(s1.value).toBe(35)
  })
  it('reports what data is still needed', () => {
    const r = computeSkills({ sessions: [], distractions: [], estimates: [], starts: [], days: [] }, now)
    expect(r.every((s) => s.value === null && s.needs)).toBe(true)
  })
  it('band changes only after holding for two weekly checks', () => {
    // Old sessions (8–20 days ago): 25 min clean → competent. New ones this week: 55 min → strong now, not a week ago.
    const old = [8, 9, 10, 12, 14, 20].map((d) => session(d, 25))
    const fresh = [1, 2, 3].map((d) => session(d, 55))
    const s1 = computeSkills({ sessions: [...old, ...fresh], distractions: [], estimates: [], starts: [], days: [] }, now)[0]!
    expect(s1.value).toBe(55)
    expect(s1.band).toBe('competent')
  })
  it('guide fades with skill and respects overrides', () => {
    expect(guideLevel(null)).toBe('full')
    expect(guideLevel('competent')).toBe('ask')
    expect(guideLevel('strong')).toBe('quiet')
    expect(guideLevel('strong', 'more')).toBe('full')
    expect(guideLevel('developing', 'less')).toBe('ask')
  })
  it('re-anchors bands to your own baseline (10% / 30% better)', () => {
    const a = anchorsFromBaseline({ S1: 20, S3: 60, S4: 0, S7: 5 })
    expect(a.S1).toEqual({ dev: 22, strong: 26 })
    expect(a.S3).toEqual({ dev: 54, strong: 42 })
    expect(a.S4).toBeUndefined()
    expect(a.S7).toBeUndefined()
    expect(bandFor('S1', 21, a)).toBe('developing') // fixed thresholds would say developing too
    expect(bandFor('S1', 27, a)).toBe('strong') // fixed thresholds would say competent
    expect(bandFor('S3', 40, a)).toBe('strong')
  })
})
