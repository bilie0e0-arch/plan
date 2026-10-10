import { describe, expect, it } from 'vitest'
import { reflowToday } from './reflow'

const t = (hhmm: string) => new Date(`2026-10-14T${hhmm}:00Z`)
const blk = (id: string, s: string, e: string) => ({ id, title: id, start: t(s), end: t(e) })

describe('reflowToday', () => {
  it('moves missed blocks into the earliest gaps after now, in order, around busy time', () => {
    const moves = reflowToday({
      now: t('10:02'), dayEnd: t('18:00'),
      missed: [blk('B', '09:00', '09:30'), blk('A', '08:00', '09:00')],
      busy: [{ start: t('10:00'), end: t('11:00') }, { start: t('11:45'), end: t('12:30') }],
    })
    expect(moves.map((m) => [m.id, m.to?.toISOString().slice(11, 16)])).toEqual([['A', '12:30'], ['B', '11:00']])
  })
  it('reports blocks that no longer fit today', () => {
    const moves = reflowToday({ now: t('17:10'), dayEnd: t('18:00'), missed: [blk('Long', '09:00', '11:00')], busy: [] })
    expect(moves[0]).toMatchObject({ id: 'Long', to: null, minutes: 120 })
  })
  it('starts no earlier than 5 minutes from now, on a 5-minute grid', () => {
    const [m] = reflowToday({ now: t('10:02'), dayEnd: t('18:00'), missed: [blk('A', '09:00', '09:25')], busy: [] })
    expect(m!.to!.toISOString().slice(11, 16)).toBe('10:10')
  })
})
