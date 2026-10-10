import { describe, expect, it } from 'vitest'
import { addDays, dayKey, dayRange, weekStart } from './day'

describe('day arithmetic', () => {
  it('applies the day boundary in the user timezone', () => {
    // 2026-10-08 21:00 UTC = 2026-10-09 02:30 IST → still the 8th with a 4am boundary
    expect(dayKey(new Date('2026-10-08T21:00:00Z'), 'Asia/Kolkata', 4)).toBe('2026-10-08')
    expect(dayKey(new Date('2026-10-08T23:00:00Z'), 'Asia/Kolkata', 4)).toBe('2026-10-09')
  })
  it('computes day ranges as UTC instants', () => {
    const r = dayRange('2026-10-08', 'Asia/Kolkata', 4)
    expect(r.start.toISOString()).toBe('2026-10-07T22:30:00.000Z')
    expect(r.end.toISOString()).toBe('2026-10-08T22:30:00.000Z')
  })
  it('handles week starts and month rollover', () => {
    expect(weekStart('2026-10-08')).toBe('2026-10-05') // Thursday → Monday
    expect(weekStart('2026-10-05')).toBe('2026-10-05')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
  })
})
