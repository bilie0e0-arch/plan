/**
 * "Re-flow the rest of today" (rule-based, previewed, the user confirms).
 * Missed blocks move, in their original order, into the earliest free gaps from now until the end of the day.
 * Everything else stays put. Blocks that no longer fit are reported, never silently dropped.
 */

const MIN = 60_000
const STEP = 5 * MIN

export interface ReflowBlock { id: string; title: string; start: Date; end: Date }
export interface ReflowMove { id: string; title: string; from: Date; to: Date | null; minutes: number }

export function reflowToday(opts: { now: Date; dayEnd: Date; missed: ReflowBlock[]; busy: { start: Date; end: Date }[] }): ReflowMove[] {
  const cursor0 = Math.ceil((opts.now.getTime() + STEP) / STEP) * STEP // a 5-minute breather, on a 5-minute grid
  const busy = opts.busy.filter((b) => b.end.getTime() > cursor0).map((b) => ({ start: b.start.getTime(), end: b.end.getTime() }))
  const moves: ReflowMove[] = []
  for (const b of [...opts.missed].sort((x, y) => x.start.getTime() - y.start.getTime())) {
    const len = b.end.getTime() - b.start.getTime()
    let at = cursor0
    let placed: number | null = null
    while (at + len <= opts.dayEnd.getTime()) {
      const clash = busy.filter((x) => x.start < at + len && x.end > at).sort((x, y) => y.end - x.end)[0]
      if (!clash) { placed = at; break }
      at = Math.ceil(clash.end / STEP) * STEP
    }
    if (placed !== null) busy.push({ start: placed, end: placed + len })
    moves.push({ id: b.id, title: b.title, from: b.start, to: placed === null ? null : new Date(placed), minutes: Math.round(len / MIN) })
  }
  return moves
}
