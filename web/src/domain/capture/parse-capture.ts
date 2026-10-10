export type Energy = 'deep' | 'shallow' | 'admin'
export type TaskKind = 'work' | 'speak'

export interface ParsedCapture {
  title: string
  projectName: string | null
  estimateMinutes: number | null
  energy: Energy | null
  kind: TaskKind
  /** Day the task should appear (day key), from "today", "tomorrow", "fri", "next mon". Needs `today`. */
  showOn: string | null
  /** Time cue (minute of day), from "3pm", "9:30am", "15:00". */
  atMinute: number | null
}

const PROJECT = /^#([\w-]{1,40})$/
const DURATION = /^~(?:(\d{1,2})h)?(?:(\d{1,4})m)?$/
const ENERGY: Record<string, Energy> = { '!deep': 'deep', '!shallow': 'shallow', '!admin': 'admin' }
const MAX_MINUTES = 1440
const TIME_12 = /^@?(\d{1,2})(?::(\d{2}))?(am|pm)$/i
const TIME_24 = /^@?([01]?\d|2[0-3]):([0-5]\d)$/
const WEEKDAYS: Record<string, number> = {
  mon: 0, monday: 0, tue: 1, tues: 1, tuesday: 1, wed: 2, weds: 2, wednesday: 2, thu: 3, thur: 3, thurs: 3, thursday: 3,
  fri: 4, friday: 4, sat: 5, saturday: 5, sun: 6, sunday: 6,
}

export function parseDuration(token: string): number | null {
  const m = DURATION.exec(token)
  if (!m || (m[1] === undefined && m[2] === undefined)) return null
  const minutes = Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)
  return minutes >= 1 && minutes <= MAX_MINUTES ? minutes : null
}

export function parseTime(token: string): number | null {
  const a = TIME_12.exec(token)
  if (a) {
    const h = Number(a[1]), m = Number(a[2] ?? 0)
    if (h < 1 || h > 12 || m > 59) return null
    return ((h % 12) + (a[3]!.toLowerCase() === 'pm' ? 12 : 0)) * 60 + m
  }
  const b = TIME_24.exec(token)
  return b ? Number(b[1]) * 60 + Number(b[2]) : null
}

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10)
}
function dow(key: string): number {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

/** "fri" → the coming Friday (today if it is Friday); "next fri" → Friday of next week (weeks start Monday). */
function weekdayDate(today: string, target: number, next: boolean): string {
  return next ? addDays(today, 7 - dow(today) + target) : addDays(today, (target - dow(today) + 7) % 7)
}

/**
 * Parses "Call Sam tomorrow 3pm #Work ~15m !deep". The first token of each type wins; the rest stays in the title.
 * Dates are only recognised when `today` (a day key) is given.
 */
export function parseCapture(raw: string, today?: string): ParsedCapture {
  let projectName: string | null = null
  let estimateMinutes: number | null = null
  let energy: Energy | null = null
  let kind: TaskKind = 'work'
  let showOn: string | null = null
  let atMinute: number | null = null
  const words: string[] = []
  const tokens = raw.trim().split(/\s+/).filter(Boolean)

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    const lower = token.toLowerCase()
    const project = PROJECT.exec(token)
    if (project && projectName === null) {
      projectName = project[1] ?? null
      continue
    }
    if (estimateMinutes === null) {
      const minutes = parseDuration(token)
      if (minutes !== null) {
        estimateMinutes = minutes
        continue
      }
    }
    const e = ENERGY[lower]
    if (e && energy === null) {
      energy = e
      continue
    }
    if (lower === '!speak' && kind === 'work') {
      kind = 'speak'
      continue
    }
    if (atMinute === null) {
      const t = parseTime(token)
      if (t !== null) {
        atMinute = t
        continue
      }
    }
    if (today && showOn === null) {
      if (lower === 'today' || lower === 'tonight') { showOn = today; continue }
      if (lower === 'tomorrow' || lower === 'tmrw' || lower === 'tmr') { showOn = addDays(today, 1); continue }
      if (lower === 'next' && tokens[i + 1] && WEEKDAYS[tokens[i + 1]!.toLowerCase()] !== undefined) {
        showOn = weekdayDate(today, WEEKDAYS[tokens[i + 1]!.toLowerCase()]!, true)
        i++
        continue
      }
      if (WEEKDAYS[lower] !== undefined) { showOn = weekdayDate(today, WEEKDAYS[lower]!, false); continue }
    }
    words.push(token)
  }

  return { title: words.join(' '), projectName, estimateMinutes, energy, kind, showOn, atMinute }
}

/**
 * Spoken capture (browser dictation, no AI): turns everyday phrases into the same tokens the parser reads.
 * "Call Sam tomorrow at 3 p.m. for 15 minutes project work deep work" → "Call Sam tomorrow 3pm ~15m #work !deep"
 */
export function normalizeSpoken(text: string): string {
  return text
    .replace(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?(?=\s|$|[,.!?])/gi, (_, h, m, ap) => `${h}${m ? `:${m}` : ''}${ap.toLowerCase()}m`)
    .replace(/\bat\s+(?=\d{1,2}(?::\d{2})?(?:am|pm)\b)/gi, '')
    .replace(/\b(?:for\s+)?half an hour\b/gi, '~30m')
    .replace(/\b(?:for\s+)?an hour\b/gi, '~1h')
    .replace(/\b(?:for\s+)?(\d{1,2})\s*(?:hours?|hrs?)\b/gi, '~$1h')
    .replace(/\b(?:for\s+)?(\d{1,4})\s*(?:minutes?|mins?)\b/gi, '~$1m')
    .replace(/\bproject\s+([\w-]{1,40})\b/gi, '#$1')
    .replace(/\bdeep work\b/gi, '!deep')
    .replace(/\badmin task\b/gi, '!admin')
    .replace(/\bshallow task\b/gi, '!shallow')
    .replace(/\bspeaking (?:task|practice)\b/gi, '!speak')
    .replace(/[,.!?]+(\s|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}
