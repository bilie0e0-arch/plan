/** Skill Engine (DESIGN §5): metrics, bands with 2-week stability, scaffold-and-fade, self-direction. */

export type SkillId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8'
export type Band = 'developing' | 'competent' | 'strong'

export interface SessionRow {
  startedAt: Date
  mode: string
  plannedMinutes: number | null
  activeSeconds: number
  outcome: 'completed' | 'stopped_early' | 'abandoned'
  isClean: boolean
  goalMet: 'yes' | 'partial' | 'no' | null
}
export interface DistractionRow { at: Date; kind: 'internal' | 'external' }
export interface EstimateRow { completedAt: Date; estimate: number; actual: number }
export interface StartRow { plannedAt: Date; startedAt: Date | null }
export interface DayRow { closedAt: Date; completionRate: number }
export interface RecordingRow { at: Date; fillersPerMin: number | null; onTarget: boolean | null; rubricAvg: number | null }
export interface OutcomeRow { at: Date; score: number | null }

export interface SkillInputs {
  sessions: SessionRow[]
  distractions: DistractionRow[]
  estimates: EstimateRow[]
  starts: StartRow[]
  days: DayRow[]
  recordings?: RecordingRow[]
  outcomes?: OutcomeRow[]
}

export interface SkillResult {
  id: SkillId
  name: string
  question: string
  value: number | null
  display: string
  band: Band | null
  previousValue: number | null
  /** 'better' | 'worse' | 'flat' relative to 7 days earlier */
  trend: 'better' | 'worse' | 'flat' | null
  detail: string
  needs: string | null
}

const DAY = 86_400_000
const WINDOW_DAYS = 28

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

interface Metric { value: number | null; detail: string; needs: string | null; extra?: { onPct: number | null; rubric: number | null } }

function within<T>(rows: T[], get: (r: T) => Date, from: Date, to: Date): T[] {
  return rows.filter((r) => get(r) >= from && get(r) < to)
}

function s1(sessions: SessionRow[]): Metric {
  const timed = sessions.filter((s) => s.plannedMinutes && (s.mode === 'ladder' || s.mode === 'timebox'))
  const groups = new Map<number, SessionRow[]>()
  for (const s of timed) groups.set(s.plannedMinutes!, [...(groups.get(s.plannedMinutes!) ?? []), s])
  let best: number | null = null
  for (const [len, rows] of groups) {
    const rate = rows.filter((r) => r.isClean).length / rows.length
    if (rows.length >= 3 && rate >= 0.8 && (best === null || len > best)) best = len
  }
  const cleanPct = timed.length ? Math.round((timed.filter((s) => s.isClean).length / timed.length) * 100) : 0
  return {
    value: best,
    detail: `${cleanPct}% of timed sessions clean`,
    needs: best === null ? 'Needs 3+ sessions at one length with 80% clean' : null,
  }
}

function s2(sessions: SessionRow[], distractions: DistractionRow[]): Metric {
  const hours = sessions.reduce((a, s) => a + s.activeSeconds, 0) / 3600
  if (hours < 2) return { value: null, detail: '', needs: `Needs ${Math.ceil((2 - hours) * 60)} more focused minutes` }
  const internal = distractions.filter((d) => d.kind === 'internal').length
  return {
    value: Math.round((distractions.length / hours) * 10) / 10,
    detail: distractions.length ? `${Math.round((internal / distractions.length) * 100)}% internal` : 'No distractions logged',
    needs: null,
  }
}

function s3(rows: EstimateRow[]): Metric {
  if (rows.length < 5) return { value: null, detail: '', needs: `Needs ${5 - rows.length} more estimated tasks done` }
  const err = median(rows.map((r) => (Math.abs(r.actual - r.estimate) / r.estimate) * 100))
  const bias = median(rows.map((r) => r.actual / r.estimate))
  const dir = bias > 1.05 ? `under-estimates by ${bias.toFixed(1)}×` : bias < 0.95 ? `over-estimates (${bias.toFixed(1)}×)` : 'no consistent bias'
  return { value: Math.round(err), detail: dir, needs: null }
}

function s4(rows: StartRow[], to: Date): Metric {
  if (rows.length < 5) return { value: null, detail: '', needs: `Needs ${5 - rows.length} more planned tasks` }
  const lat = rows.map((r) => ((r.startedAt ?? to).getTime() - r.plannedAt.getTime()) / DAY)
  const notStarted = rows.filter((r) => !r.startedAt).length
  return { value: Math.round(median(lat) * 10) / 10, detail: `${notStarted} planned but not started`, needs: null }
}

function s5(days: DayRow[]): Metric {
  if (days.length < 5) return { value: null, detail: '', needs: `Needs ${5 - days.length} more closed days` }
  const inBand = days.filter((d) => d.completionRate >= 0.6 && d.completionRate <= 0.85).length
  const over = days.filter((d) => d.completionRate < 0.6).length
  return { value: Math.round((inBand / days.length) * 100), detail: `${over} over-planned days`, needs: null }
}

function s6(sessions: SessionRow[]): Metric {
  const rated = sessions.filter((s) => s.goalMet)
  if (rated.length < 5) return { value: null, detail: '', needs: `Needs ${5 - rated.length} more sessions with a goal` }
  const score = rated.reduce((a, s) => a + (s.goalMet === 'yes' ? 1 : s.goalMet === 'partial' ? 0.5 : 0), 0)
  return { value: Math.round((score / rated.length) * 100), detail: `${rated.length} sessions rated`, needs: null }
}

function s7(rows: RecordingRow[]): Metric {
  if (rows.length < 3) return { value: null, detail: '', needs: `Needs ${3 - rows.length} more speaking drills` }
  const fillers = rows.filter((r) => r.fillersPerMin !== null).map((r) => r.fillersPerMin!)
  const value = fillers.length ? Math.round(median(fillers) * 10) / 10 : null
  const onTarget = rows.filter((r) => r.onTarget !== null)
  const onPct = onTarget.length ? Math.round((onTarget.filter((r) => r.onTarget).length / onTarget.length) * 100) : null
  const rated = rows.filter((r) => r.rubricAvg !== null).map((r) => r.rubricAvg!)
  const rubric = rated.length ? Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10 : null
  return { value, detail: `${onPct ?? '—'}% on target time · self-rating ${rubric ?? '—'}/5`, needs: value === null ? 'Needs transcribed drills' : null, extra: { onPct, rubric } }
}

function s8(rows: OutcomeRow[]): Metric {
  const scored = rows.filter((r) => r.score !== null)
  if (scored.length < 5) return { value: null, detail: '', needs: `Needs ${5 - scored.length} more finished blocks` }
  const released = rows.length - scored.length
  return {
    value: Math.round((scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length) * 100),
    detail: `${scored.length} committed blocks · ${released} released early`,
    needs: null,
  }
}

/** Higher-is-better skills: S1, S5, S6. Lower-is-better: S2, S3, S4. */
const DEF: Record<SkillId, { name: string; question: string; higherBetter: boolean; dev: number; strong: number; fmt: (v: number) => string }> = {
  S1: { name: 'Focus Capacity', question: 'How long can I work without breaking?', higherBetter: true, dev: 25, strong: 50, fmt: (v) => `${v} min` },
  S2: { name: 'Attention Control', question: 'How often am I pulled away?', higherBetter: false, dev: 4, strong: 2, fmt: (v) => `${v}/hr` },
  S3: { name: 'Estimation', question: 'How accurate are my time predictions?', higherBetter: false, dev: 50, strong: 25, fmt: (v) => `±${v}%` },
  S4: { name: 'Starting', question: 'How quickly do I start what I planned?', higherBetter: false, dev: 2, strong: 0.5, fmt: (v) => `${v} d` },
  S5: { name: 'Planning', question: 'Do my days go as planned?', higherBetter: true, dev: 50, strong: 75, fmt: (v) => `${v}%` },
  S6: { name: 'Delivery', question: 'Do my sessions produce what I intended?', higherBetter: true, dev: 50, strong: 75, fmt: (v) => `${v}%` },
  S7: { name: 'Speaking', question: 'Do I speak clearly, concisely and confidently?', higherBetter: false, dev: 6, strong: 3, fmt: (v) => `${v} fillers/min` },
  S8: { name: 'Reliability', question: 'Do I do what I committed to, when I said I would?', higherBetter: true, dev: 60, strong: 80, fmt: (v) => `${v}% kept` },
}

const BAND_RANK: Record<Band, number> = { developing: 0, competent: 1, strong: 2 }

/** Speaking band = weakest of filler rate, on-target %, self-rating (DESIGN §5.2). */
function speakingBand(m: Metric): Band | null {
  if (m.value === null) return null
  const f: Band = m.value < 3 ? 'strong' : m.value <= 6 ? 'competent' : 'developing'
  const parts: Band[] = [f]
  const on = m.extra?.onPct
  if (on != null) parts.push(on > 80 ? 'strong' : on >= 50 ? 'competent' : 'developing')
  const r = m.extra?.rubric
  if (r != null) parts.push(r > 4 ? 'strong' : r >= 3 ? 'competent' : 'developing')
  return parts.reduce((a, b) => (BAND_RANK[b] < BAND_RANK[a] ? b : a))
}

/** Personal thresholds after re-anchoring (DESIGN §5.2): you vs your own baseline. */
export type Anchors = Partial<Record<SkillId, { dev: number; strong: number }>>

export function bandFor(id: SkillId, value: number | null, anchors?: Anchors): Band | null {
  if (value === null) return null
  const d = DEF[id]
  const t = anchors?.[id] ?? d
  if (d.higherBetter) return value > t.strong ? 'strong' : value >= t.dev ? 'competent' : 'developing'
  return value < t.strong ? 'strong' : value <= t.dev ? 'competent' : 'developing'
}

/** Raw metric values at a moment (used to capture the baseline for re-anchoring). */
export function metricValuesAt(inputs: SkillInputs, at: Date): Record<SkillId, number | null> {
  const m = metricsAt(inputs, at)
  return Object.fromEntries((Object.keys(m) as SkillId[]).map((id) => [id, m[id].value])) as Record<SkillId, number | null>
}

/**
 * Re-anchor after 8 weeks: Competent = 10% better than your baseline, Strong = 30% better.
 * Speaking keeps its composite band; skills with no baseline (or a zero one) keep the fixed thresholds.
 */
export function anchorsFromBaseline(baseline: Partial<Record<SkillId, number | null>>): Anchors {
  const out: Anchors = {}
  for (const id of Object.keys(DEF) as SkillId[]) {
    const b = baseline[id]
    if (id === 'S7' || b == null || b <= 0) continue
    const up = DEF[id].higherBetter
    const round = (x: number) => Math.round(x * 100) / 100
    out[id] = up ? { dev: round(b * 1.1), strong: round(b * 1.3) } : { dev: round(b * 0.9), strong: round(b * 0.7) }
  }
  return out
}

function metricsAt(inputs: SkillInputs, to: Date): Record<SkillId, Metric> {
  const from = new Date(to.getTime() - WINDOW_DAYS * DAY)
  const sessions = within(inputs.sessions, (s) => s.startedAt, from, to)
  return {
    S1: s1(sessions),
    S2: s2(sessions, within(inputs.distractions, (d) => d.at, from, to)),
    S3: s3(within(inputs.estimates, (e) => e.completedAt, from, to)),
    S4: s4(within(inputs.starts, (s) => s.plannedAt, from, to), to),
    S5: s5(within(inputs.days, (d) => d.closedAt, from, to)),
    S6: s6(sessions),
    S7: s7(within(inputs.recordings ?? [], (r) => r.at, from, to)),
    S8: s8(within(inputs.outcomes ?? [], (o) => o.at, from, to)),
  }
}

export function computeSkills(inputs: SkillInputs, now: Date, anchors?: Anchors): SkillResult[] {
  const cur = metricsAt(inputs, now)
  const prev = metricsAt(inputs, new Date(now.getTime() - 7 * DAY))
  return (Object.keys(DEF) as SkillId[]).map((id) => {
    const d = DEF[id]
    const v = cur[id].value
    const pv = prev[id].value
    const b = id === 'S7' ? speakingBand(cur[id]) : bandFor(id, v, anchors)
    const pb = id === 'S7' ? speakingBand(prev[id]) : bandFor(id, pv, anchors)
    // Band changes only after holding for two consecutive weekly checks.
    const band = b && pb && b !== pb ? pb : b
    let trend: SkillResult['trend'] = null
    if (v !== null && pv !== null) {
      const diff = d.higherBetter ? v - pv : pv - v
      trend = Math.abs(diff) < 1e-9 ? 'flat' : diff > 0 ? 'better' : 'worse'
    }
    return {
      id, name: d.name, question: d.question, value: v, display: v === null ? '—' : d.fmt(v),
      band, previousValue: pv, trend, detail: cur[id].detail, needs: cur[id].needs,
    }
  })
}

// ───────────── Scaffold, then fade (DESIGN §10.13) ─────────────

export type GuideArea = 'now_card' | 'timer_mode' | 'morning_ritual' | 'session_goal'
export type GuideLevel = 'full' | 'ask' | 'quiet'
export type Override = 'more' | 'auto' | 'less'

export const AREA_SKILL: Record<GuideArea, SkillId> = {
  now_card: 'S5',
  timer_mode: 'S1',
  morning_ritual: 'S5',
  session_goal: 'S6',
}

export function guideLevel(band: Band | null, override: Override = 'auto'): GuideLevel {
  const auto: GuideLevel = band === 'strong' ? 'quiet' : band === 'competent' ? 'ask' : 'full'
  if (override === 'more') return 'full'
  if (override === 'less') return auto === 'full' ? 'ask' : 'quiet'
  return auto
}

export function selfDirectionRate(events: { source: string; at: Date }[], now: Date): number | null {
  const from = new Date(now.getTime() - WINDOW_DAYS * DAY)
  const recent = events.filter((e) => e.at >= from && e.at <= now)
  if (recent.length < 5) return null
  return Math.round((recent.filter((e) => e.source === 'self').length / recent.length) * 100)
}
