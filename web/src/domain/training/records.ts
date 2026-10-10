/** Personal records (DESIGN §10.11): honest, ability-based, celebrated only when broken. */

export type RecordType = 'longest_clean_session' | 'most_focus_day' | 'lowest_filler_rate' | 'best_kept_week'

export const RECORDS: Record<RecordType, { label: string; lowerBetter: boolean; fmt: (v: number) => string }> = {
  longest_clean_session: { label: 'Longest clean session', lowerBetter: false, fmt: (v) => `${Math.round(v)} min` },
  most_focus_day: { label: 'Most focus in a day', lowerBetter: false, fmt: (v) => `${Math.floor(v / 60)}h ${Math.round(v % 60)}m` },
  lowest_filler_rate: { label: 'Lowest filler rate', lowerBetter: true, fmt: (v) => `${v}/min` },
  best_kept_week: { label: 'Best kept-week', lowerBetter: false, fmt: (v) => `${Math.round(v)}%` },
}

export interface RecordCandidate { type: RecordType; value: number; at: Date; refId: string | null }
export interface RecordUpdate extends RecordCandidate { previous: number | null; celebrate: boolean }

/**
 * Compare the best candidate per type with the stored record.
 * First value ever = quiet baseline (no celebration); beating it = celebration.
 */
export function detectRecords(candidates: RecordCandidate[], existing: Map<RecordType, number>): RecordUpdate[] {
  const best = new Map<RecordType, RecordCandidate>()
  for (const c of candidates) {
    const cur = best.get(c.type)
    const lower = RECORDS[c.type].lowerBetter
    if (!cur || (lower ? c.value < cur.value : c.value > cur.value)) best.set(c.type, c)
  }
  const out: RecordUpdate[] = []
  for (const [type, c] of best) {
    const prev = existing.get(type)
    if (prev === undefined) { out.push({ ...c, previous: null, celebrate: false }); continue }
    const better = RECORDS[type].lowerBetter ? c.value < prev : c.value > prev
    if (better) out.push({ ...c, previous: prev, celebrate: true })
  }
  return out
}
