/** Habits: consistency %, never miss twice — no streak headline (DESIGN F18, §13.10). */
import { addDays, dayOfWeek } from '@/domain/time/day'

export type HabitCell = 'done' | 'miss' | 'second_miss' | 'off' | 'pending' | 'none'

export interface HabitGrid { days: { day: string; state: HabitCell }[]; consistency: number | null; missedYesterday: boolean }

/**
 * `days` cells for the window ending today. A single miss is neutral (hollow grey);
 * a second consecutive scheduled miss is amber. Today is "pending" until done.
 */
export function habitGrid(opts: { today: string; windowDays: number; weekdays: number[]; createdDay: string; doneDays: Set<string> }): HabitGrid {
  const cells: { day: string; state: HabitCell }[] = []
  let prevScheduledMissed = false
  let scheduled = 0
  let done = 0
  for (let i = opts.windowDays - 1; i >= 0; i--) {
    const day = addDays(opts.today, -i)
    let state: HabitCell
    if (day < opts.createdDay) state = 'none'
    else if (opts.doneDays.has(day)) {
      state = 'done'
      if (opts.weekdays.includes(dayOfWeek(day))) { scheduled++; done++; prevScheduledMissed = false }
    } else if (!opts.weekdays.includes(dayOfWeek(day))) state = 'off'
    else if (day === opts.today) state = 'pending'
    else {
      scheduled++
      state = prevScheduledMissed ? 'second_miss' : 'miss'
      prevScheduledMissed = true
    }
    cells.push({ day, state })
  }
  const past = cells.filter((c) => c.day < opts.today && c.state !== 'none' && c.state !== 'off')
  const last = past.at(-1)
  return {
    days: cells,
    consistency: scheduled ? Math.round((done / scheduled) * 100) : null,
    missedYesterday: !!last && last.state === 'miss',
  }
}
