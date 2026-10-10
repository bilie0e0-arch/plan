import { describe, expect, it } from 'vitest'
import { freshStart, reflectionQuestion, reviewWeeks } from './week'
import { MISSIONS, missionProgress, suggestMissionSkill, type WeekActivity } from './missions'
import { detectRecords } from './records'
import { calibration, commitmentSuggestion } from './commitments'
import { habitGrid } from './habits'
import { isAged } from './aging'
import { computeInsights, type InsightData } from './insights'

describe('weekly rhythm', () => {
  it('plans the current week early in the week and the next week from Friday', () => {
    expect(reviewWeeks('2026-10-13')).toEqual({ planWeek: '2026-10-12', reviewedWeek: '2026-10-05' }) // Tue
    expect(reviewWeeks('2026-10-16')).toEqual({ planWeek: '2026-10-19', reviewedWeek: '2026-10-12' }) // Fri
    expect(reviewWeeks('2026-10-18')).toEqual({ planWeek: '2026-10-19', reviewedWeek: '2026-10-12' }) // Sun
  })
  it('fresh start on Mondays and the 1st (month wins)', () => {
    expect(freshStart('2026-10-12')).toBe('week')
    expect(freshStart('2026-11-01')).toBe('month')
    expect(freshStart('2026-10-14')).toBeNull()
  })
  it('reflection question rotates by day', () => {
    expect(reflectionQuestion('2026-10-12')).not.toBe(reflectionQuestion('2026-10-13'))
    expect(reflectionQuestion('2026-10-12')).toBe(reflectionQuestion('2026-10-12'))
  })
})

describe('missions', () => {
  const week: WeekActivity = {
    sessions: [
      { mode: 'blind', outcome: 'completed', isClean: true, distractions: 0, activeMinutes: 30, goalMet: 'yes' },
      { mode: 'blind', outcome: 'abandoned', isClean: false, distractions: 0, activeMinutes: 1, goalMet: null },
      { mode: 'ladder', outcome: 'completed', isClean: true, distractions: 1, activeMinutes: 25, goalMet: 'partial' },
      { mode: 'ladder', outcome: 'stopped_early', isClean: false, distractions: 3, activeMinutes: 12, goalMet: 'no' },
    ],
    closedDays: 2, recordings: 1, keptBlocks: 3,
  }
  it('counts progress from the week’s own data (abandoned never counts)', () => {
    expect(missionProgress('S3', week)).toBe(1)
    expect(missionProgress('S1', week)).toBe(1)
    expect(missionProgress('S2', week)).toBe(2)
    expect(missionProgress('S6', week)).toBe(1)
    expect(missionProgress('S8', week)).toBe(3)
    expect(MISSIONS.S3.target).toBe(10)
  })
  it('suggests the weakest trend, then the lowest band', () => {
    expect(suggestMissionSkill([
      { id: 'S1', value: 30, band: 'competent', trend: 'better' },
      { id: 'S3', value: 60, band: 'developing', trend: 'flat' },
      { id: 'S8', value: 85, band: 'strong', trend: 'worse' },
    ])).toBe('S8')
    expect(suggestMissionSkill([
      { id: 'S1', value: 30, band: 'competent', trend: 'better' },
      { id: 'S3', value: 60, band: 'developing', trend: 'better' },
    ])).toBe('S3')
    expect(suggestMissionSkill([{ id: 'S2', value: null, band: null, trend: null }])).toBe('S1')
  })
})

describe('personal records', () => {
  const at = new Date()
  it('first value is a quiet baseline; beating it celebrates', () => {
    const first = detectRecords([{ type: 'longest_clean_session', value: 40, at, refId: null }], new Map())
    expect(first[0]).toMatchObject({ value: 40, celebrate: false })
    const beaten = detectRecords([
      { type: 'longest_clean_session', value: 45, at, refId: null },
      { type: 'longest_clean_session', value: 55, at, refId: 'x' },
    ], new Map([['longest_clean_session', 50]]))
    expect(beaten).toEqual([expect.objectContaining({ value: 55, previous: 50, celebrate: true, refId: 'x' })])
  })
  it('lower is better for filler rate; equal is not a record', () => {
    expect(detectRecords([{ type: 'lowest_filler_rate', value: 2.1, at, refId: null }], new Map([['lowest_filler_rate', 1.8]]))).toEqual([])
    expect(detectRecords([{ type: 'lowest_filler_rate', value: 1.5, at, refId: null }], new Map([['lowest_filler_rate', 1.8]]))[0]?.celebrate).toBe(true)
    expect(detectRecords([{ type: 'best_kept_week', value: 80, at, refId: null }], new Map([['best_kept_week', 80]]))).toEqual([])
  })
})

describe('commitment ladder & calibration', () => {
  it('suggests committing to what you deliver after 3 short weeks', () => {
    const s = commitmentSuggestion('GMAT', [{ committed: 600, actual: 360 }, { committed: 600, actual: 350 }, { committed: 600, actual: 370 }], 600)
    expect(s).toMatchObject({ kind: 'down', minutes: 390 })
    expect(s!.text).toContain('6.5h')
  })
  it('two short weeks are not enough; two kept weeks suggest +10%', () => {
    expect(commitmentSuggestion('GMAT', [{ committed: 600, actual: 600 }, { committed: 600, actual: 300 }, { committed: 600, actual: 300 }], 600)).toBeNull()
    expect(commitmentSuggestion('GMAT', [{ committed: 300, actual: 290 }, { committed: 300, actual: 320 }], 300)).toMatchObject({ kind: 'up', minutes: 330 })
  })
  it('Brier score and over-confidence', () => {
    expect(calibration([{ p: 0.9, hit: true }])).toBeNull()
    const c = calibration([{ p: 0.9, hit: false }, { p: 0.8, hit: true }, { p: 0.9, hit: false }, { p: 0.8, hit: true }])!
    expect(c.overconfidence).toBe(35)
    expect(c.brier).toBeCloseTo((0.81 + 0.04 + 0.81 + 0.04) / 4, 3)
  })
})

describe('habits', () => {
  it('single miss is neutral, a second consecutive miss is amber, today is pending', () => {
    // 2026-10-12 is a Monday; daily habit created on the 8th
    const g = habitGrid({ today: '2026-10-12', windowDays: 7, weekdays: [0, 1, 2, 3, 4, 5, 6], createdDay: '2026-10-08', doneDays: new Set(['2026-10-08', '2026-10-10']) })
    expect(g.days.map((d) => d.state)).toEqual(['none', 'none', 'done', 'miss', 'done', 'miss', 'pending'])
    const g2 = habitGrid({ today: '2026-10-12', windowDays: 7, weekdays: [0, 1, 2, 3, 4, 5, 6], createdDay: '2026-10-08', doneDays: new Set(['2026-10-08']) })
    expect(g2.days.map((d) => d.state).slice(2)).toEqual(['done', 'miss', 'second_miss', 'second_miss', 'pending'])
    expect(g.consistency).toBe(50)
    expect(g.missedYesterday).toBe(true)
  })
  it('unscheduled days are off and do not count', () => {
    const g = habitGrid({ today: '2026-10-12', windowDays: 7, weekdays: [0, 2, 4], createdDay: '2026-10-01', doneDays: new Set(['2026-10-07', '2026-10-09']) })
    expect(g.days.map((d) => d.state)).toEqual(['off', 'done', 'off', 'done', 'off', 'off', 'pending'])
    expect(g.consistency).toBe(100)
  })
})

describe('aging', () => {
  const now = new Date('2026-10-30T12:00:00Z')
  it('only untouched active tasks age; someday never does', () => {
    expect(isAged({ status: 'backlog', lastTouchedAt: new Date('2026-10-15T11:00:00Z') }, now, 14)).toBe(true)
    expect(isAged({ status: 'backlog', lastTouchedAt: new Date('2026-10-20T11:00:00Z') }, now, 14)).toBe(false)
    expect(isAged({ status: 'someday', lastTouchedAt: new Date('2026-01-01T00:00:00Z') }, now, 14)).toBe(false)
  })
})

describe('insights', () => {
  const empty: InsightData = { estimates: [], sessions: [], blocks: [], goals: [], forecasts: [], starts: [], recordings: [] }
  it('stays silent without enough data', () => {
    expect(computeInsights(empty)).toEqual([])
  })
  it('estimation bias by project', () => {
    const est = [1.7, 1.6, 1.8].map((r) => ({ project: 'Writing', ratio: r })).concat([1.1, 1.0, 1.1].map((r) => ({ project: 'Code', ratio: r })))
    const [i] = computeInsights({ ...empty, estimates: est })
    expect(i!.text).toBe('You underestimate Writing by 1.7×, but Code by only 1.1×.')
  })
  it('blocks kept by time of day, with an action', () => {
    const blocks = [8, 8, 9, 10].map((h) => ({ localHour: h, outcome: 'kept', score: 1, moved: false }))
      .concat([19, 20, 20].map((h) => ({ localHour: h, outcome: 'missed', score: 0, moved: false })))
    const [i] = computeInsights({ ...empty, blocks })
    expect(i!.text).toBe('Blocks before noon: 100% kept. After 6 pm: 0%.')
    expect(i!.action?.href).toBe('/calendar')
  })
  it('top filler and retake improvement', () => {
    const recordings: InsightData['recordings'] = [
      { fillerBreakdown: { basically: 6, um: 2 }, take: 1, fillersPerMin: 6, parentFillersPerMin: null },
      { fillerBreakdown: { basically: 2, like: 2 }, take: 2, fillersPerMin: 3, parentFillersPerMin: 6 },
      { fillerBreakdown: { basically: 1 }, take: 2, fillersPerMin: 2, parentFillersPerMin: 5 },
    ]
    const [i] = computeInsights({ ...empty, recordings })
    expect(i!.text).toBe('Your top filler is “basically” (69%). Filler rate halves on your retakes.')
  })
})
