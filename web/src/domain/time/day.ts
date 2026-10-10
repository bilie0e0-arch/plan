/**
 * Day arithmetic in the user's timezone with a configurable day boundary
 * (e.g. boundary 4 → 02:30 still belongs to "yesterday").
 * Day keys are 'YYYY-MM-DD' strings.
 */

const MS_HOUR = 3_600_000
const MS_DAY = 24 * MS_HOUR

interface Parts { year: number; month: number; day: number; hour: number; minute: number; second: number }

function partsInZone(date: Date, timeZone: string): Parts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const get = (type: string) => Number(fmt.formatToParts(date).find((p) => p.type === type)?.value ?? 0)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The user's current day key, shifted by the day boundary. */
export function dayKey(now: Date, timeZone: string, boundaryHour: number): string {
  const p = partsInZone(new Date(now.getTime() - boundaryHour * MS_HOUR), timeZone)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  const t = new Date(Date.UTC(y, m - 1, d) + n * MS_DAY)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** Monday of the week containing `key`. */
export function weekStart(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  return addDays(key, -((dow + 6) % 7))
}

/** 0 = Monday … 6 = Sunday */
export function dayOfWeek(key: string): number {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

function offsetMs(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000
}

/** UTC instant of local wall-clock time in a timezone. */
export function zonedToUtc(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour)
  const first = guess - offsetMs(new Date(guess), timeZone)
  return new Date(guess - offsetMs(new Date(first), timeZone))
}

/** [start, end) of a day key as UTC instants, honouring the day boundary. */
export function dayRange(key: string, timeZone: string, boundaryHour: number): { start: Date; end: Date } {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  const next = addDays(key, 1).split('-').map(Number) as [number, number, number]
  return {
    start: zonedToUtc(y, m, d, boundaryHour, timeZone),
    end: zonedToUtc(next[0], next[1], next[2], boundaryHour, timeZone),
  }
}

/** Local hour (0–23) in the user's timezone. */
export function localHour(now: Date, timeZone: string): number {
  return partsInZone(now, timeZone).hour
}

/** Hours remaining until the user's day boundary. */
export function hoursUntilDayEnd(now: Date, timeZone: string, boundaryHour: number): number {
  const key = dayKey(now, timeZone, boundaryHour)
  return (dayRange(key, timeZone, boundaryHour).end.getTime() - now.getTime()) / MS_HOUR
}

/** Local day key and minute-of-day of an instant in a timezone (no day-boundary shift). */
export function localDayMinute(date: Date, timeZone: string): { key: string; minute: number } {
  const p = partsInZone(date, timeZone)
  return { key: `${p.year}-${pad(p.month)}-${pad(p.day)}`, minute: p.hour * 60 + p.minute }
}

/** UTC instant for a local day key + minute-of-day in a timezone. */
export function localToUtc(key: string, minute: number, timeZone: string): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return new Date(zonedToUtc(y, m, d, 0, timeZone).getTime() + minute * 60_000)
}
