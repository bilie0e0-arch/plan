import { describe, expect, it } from 'vitest'
import { parseBlockText } from './parse-block'

const today = '2026-10-14' // Wednesday

describe('parseBlockText', () => {
  it('reads a time range, a day word and a project name', () => {
    expect(parseBlockText('Biology 4-6pm tomorrow', today, ['Biology', 'Spanish'])).toEqual({
      title: 'Biology', day: '2026-10-15', start: 16 * 60, minutes: 120, projectName: 'Biology',
    })
    expect(parseBlockText('Essay plan 9:30-11am fri', today)).toMatchObject({ title: 'Essay plan', day: '2026-10-16', start: 570, minutes: 90 })
    expect(parseBlockText('Revise 16:00-17:30', today)).toMatchObject({ start: 960, minutes: 90 })
    expect(parseBlockText('Read 11am-1pm', today)).toMatchObject({ start: 660, minutes: 120 })
  })

  it('reads a start time with a length, or one hour by default', () => {
    expect(parseBlockText('Spanish 30m fri 7am', today, ['Spanish'])).toMatchObject({ day: '2026-10-16', start: 420, minutes: 30, projectName: 'Spanish' })
    expect(parseBlockText('Guitar ~45m 6pm', today)).toMatchObject({ title: 'Guitar', start: 1080, minutes: 45 })
    expect(parseBlockText('Mock exam 2pm 3h sat', today)).toMatchObject({ title: 'Mock exam', day: '2026-10-17', start: 840, minutes: 180 })
    expect(parseBlockText('Walk 5pm', today)).toMatchObject({ day: today, start: 1020, minutes: 60 })
  })

  it('has no start when no time is given, and uses #tags', () => {
    expect(parseBlockText('#Maths past paper', today)).toMatchObject({ title: 'past paper', start: null, projectName: 'Maths' })
    expect(parseBlockText('  ', today).title).toBe('')
  })
})
