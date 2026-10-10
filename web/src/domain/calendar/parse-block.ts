import { normalizeSpoken, parseCapture } from '@/domain/capture/parse-capture'

export interface ParsedBlock {
  title: string
  /** Day key; defaults to today. */
  day: string
  /** Minute of day, or null when no time was given (the block can't be placed yet). */
  start: number | null
  minutes: number
  /** A project named in the text (#tag or a project's name as a word). */
  projectName: string | null
}

const RANGE = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i
const BARE_MINUTES = /(?:^|\s)(\d{1,3})\s*(?:m|min|mins|minutes)(?=\s|$)/i
const BARE_HOURS = /(?:^|\s)(\d(?:\.\d)?)\s*h(?:r|rs|ours?)?(?=\s|$)/i

const to24 = (h: number, m: number, ap: string | undefined) => {
  if (ap) return ((h % 12) + (ap.toLowerCase() === 'pm' ? 12 : 0)) * 60 + m
  if (h >= 13 || h === 12) return h * 60 + m // 24-hour clock, or noon
  return (h < 7 ? h + 12 : h) * 60 + m // "4-6" during a day means afternoon
}

/**
 * "Biology 4-6pm tomorrow", "Spanish 30m fri 7am", "#Maths 9:00-10:30" → a block to place.
 * Ranges set both ends; otherwise a length (~1h, 45m) or one hour by default.
 */
export function parseBlockText(raw: string, today: string, projects: string[] = []): ParsedBlock {
  let text = normalizeSpoken(raw.trim())
  let start: number | null = null
  let minutes: number | null = null

  const r = RANGE.exec(text)
  if (r) {
    const endAp = r[6] ?? r[3]
    const startAp = r[3] ?? (endAp && Number(r[1]) <= Number(r[4]) ? endAp : undefined)
    const s = to24(Number(r[1]), Number(r[2] ?? 0), startAp)
    let e = to24(Number(r[4]), Number(r[5] ?? 0), endAp)
    if (e <= s) e += 12 * 60
    if (e - s > 0 && e - s <= 12 * 60) { start = s; minutes = e - s }
    text = text.replace(r[0], ' ')
  }
  const bm = BARE_MINUTES.exec(text)
  if (bm && minutes === null) { minutes = Number(bm[1]); text = text.replace(bm[0], ' ') }
  const bh = BARE_HOURS.exec(text)
  if (bh && minutes === null) { minutes = Math.round(Number(bh[1]) * 60); text = text.replace(bh[0], ' ') }

  const p = parseCapture(text.replace(/\s+/g, ' ').trim(), today)
  if (start === null) start = p.atMinute
  if (minutes === null) minutes = p.estimateMinutes ?? 60
  let projectName = p.projectName
  if (!projectName) {
    const words = new Set(p.title.toLowerCase().split(/\s+/))
    projectName = projects.find((n) => n.toLowerCase().split(/\s+/).every((w) => words.has(w))) ?? null
  }
  const title = p.title.replace(/\s+/g, ' ').trim() || projectName || ''
  return { title, day: p.showOn ?? today, start, minutes: Math.max(5, Math.min(600, minutes)), projectName }
}
