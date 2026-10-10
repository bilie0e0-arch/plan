import { describe, expect, it } from 'vitest'
import { normalizeSpoken, parseCapture, parseTime } from './parse-capture'

describe('parseCapture', () => {
  it('extracts tokens anywhere in the text', () => {
    expect(parseCapture('#GMAT Open RC set 4 ~30m !deep')).toEqual({
      title: 'Open RC set 4', projectName: 'GMAT', estimateMinutes: 30, energy: 'deep', kind: 'work', showOn: null, atMinute: null,
    })
  })
  it.each([['~1h', 60], ['~1h30m', 90], ['~45m', 45]])('parses %s', (tok, min) => {
    expect(parseCapture(`Draft ${tok}`).estimateMinutes).toBe(min)
  })
  it('keeps invalid durations and repeated tokens as text', () => {
    expect(parseCapture('Rest ~0m').title).toBe('Rest ~0m')
    expect(parseCapture('#A #B task ~10m ~20m')).toMatchObject({ projectName: 'A', estimateMinutes: 10, title: '#B task ~20m' })
  })
  it('handles !speak and token-only input', () => {
    expect(parseCapture('Interview answer !speak').kind).toBe('speak')
    expect(parseCapture('  #GMAT  ~30m ').title).toBe('')
  })
  it('reads dates and times only when today is known', () => {
    const today = '2026-10-14' // Wednesday
    expect(parseCapture('Call Sam tomorrow 3pm', today)).toMatchObject({ title: 'Call Sam', showOn: '2026-10-15', atMinute: 900 })
    expect(parseCapture('Review fri', today).showOn).toBe('2026-10-16')
    expect(parseCapture('Review wed', today).showOn).toBe('2026-10-14')
    expect(parseCapture('Plan next mon 9:30am', today)).toMatchObject({ title: 'Plan', showOn: '2026-10-19', atMinute: 570 })
    expect(parseCapture('Plan next fri', today).showOn).toBe('2026-10-23')
    expect(parseCapture('Call Sam tomorrow').showOn).toBeNull()
    expect(parseCapture('Call Sam tomorrow').title).toBe('Call Sam tomorrow')
  })
  it('parses 12h and 24h times', () => {
    expect(parseTime('12am')).toBe(0)
    expect(parseTime('12pm')).toBe(720)
    expect(parseTime('15:05')).toBe(905)
    expect(parseTime('13pm')).toBeNull()
  })
  it('turns spoken phrases into tokens', () => {
    expect(normalizeSpoken('Call Sam tomorrow at 3 p.m. for 15 minutes, project work, deep work.'))
      .toBe('Call Sam tomorrow 3pm ~15m #work !deep')
    expect(normalizeSpoken('Read chapter for half an hour')).toBe('Read chapter ~30m')
    expect(parseCapture(normalizeSpoken('Write intro for 2 hours project book'), '2026-10-14'))
      .toMatchObject({ title: 'Write intro', estimateMinutes: 120, projectName: 'book' })
  })
})
