/**
 * Insight cards (DESIGN §5.4, §9.7): factual pattern cards computed and worded by rules.
 * Each rule needs a minimum sample and a meaningful difference, otherwise it stays silent.
 */

export interface InsightData {
  estimates: { project: string | null; ratio: number }[] // actual ÷ estimate
  sessions: {
    localHour: number; activeMinutes: number; distractions: { kind: 'internal' | 'external'; localHour: number }[]
    plannedMinutes: number | null; mode: string; outcome: string; isClean: boolean; dayEnergy: number | null
  }[]
  blocks: { localHour: number; outcome: string; score: number | null; moved: boolean }[]
  goals: { id: string; title: string; committed: number; actual: number; weeks: number }[] // minutes summed over `weeks`
  forecasts: { p: number; hit: boolean }[]
  starts: { hasCue: boolean; latencyDays: number }[]
  recordings: { fillerBreakdown: Record<string, number>; take: number; fillersPerMin: number | null; parentFillersPerMin: number | null }[]
}

export interface Insight { id: string; text: string; action?: { label: string; href: string }; strength: number }

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}
const pct = (x: number) => `${Math.round(x * 100)}%`
const x1 = (x: number) => `${Math.round(x * 10) / 10}×`
const h1 = (m: number) => `${Math.round((m / 60) * 10) / 10}h`

function estimationByProject(d: InsightData): Insight | null {
  const groups = new Map<string, number[]>()
  for (const e of d.estimates) {
    if (!e.project) continue
    groups.set(e.project, [...(groups.get(e.project) ?? []), e.ratio])
  }
  const meds = [...groups.entries()].filter(([, r]) => r.length >= 3).map(([p, r]) => ({ p, m: median(r) }))
  if (meds.length >= 2) {
    meds.sort((a, b) => b.m - a.m)
    const hi = meds[0]!, lo = meds[meds.length - 1]!
    if (hi.m >= 1.15 && hi.m - lo.m >= 0.3) {
      return { id: 'estimation_by_project', strength: hi.m - lo.m, text: `You underestimate ${hi.p} by ${x1(hi.m)}, but ${lo.p} by only ${x1(lo.m)}.` }
    }
  }
  if (d.estimates.length >= 5) {
    const m = median(d.estimates.map((e) => e.ratio))
    if (m >= 1.3) return { id: 'estimation_overall', strength: m - 1, text: `Your tasks take ${x1(m)} your estimates. The plan already corrects for it — keep estimating.` }
  }
  return null
}

function interruptionsByTime(d: InsightData): Insight | null {
  const early = d.sessions.filter((s) => s.localHour < 15)
  const late = d.sessions.filter((s) => s.localHour >= 15)
  const hrs = (xs: typeof early) => xs.reduce((a, s) => a + s.activeMinutes, 0) / 60
  if (hrs(early) < 1 || hrs(late) < 1) return null
  const count = (xs: typeof early) => xs.reduce((a, s) => a + s.distractions.length, 0)
  const rE = count(early) / hrs(early), rL = count(late) / hrs(late)
  if (rL < 1 || rL < 1.5 * Math.max(rE, 0.1)) return null
  const lateD = late.flatMap((s) => s.distractions)
  const internal = lateD.filter((x) => x.kind === 'internal').length / Math.max(1, lateD.length)
  const ratio = rE > 0 ? `${x1(rL / rE)} higher` : 'much higher'
  return {
    id: 'interruptions_afternoon', strength: rL / Math.max(rE, 0.5),
    text: `Interruptions are ${ratio} after 3 pm. ${pct(internal)} of them are internal.`,
    action: { label: 'Move deep work before 3 pm?', href: '/calendar' },
  }
}

function longSessions(d: InsightData): Insight | null {
  const timed = d.sessions.filter((s) => s.plannedMinutes && (s.mode === 'ladder' || s.mode === 'timebox') && s.outcome !== 'abandoned')
  const short = timed.filter((s) => s.plannedMinutes! <= 50), long = timed.filter((s) => s.plannedMinutes! > 50)
  if (short.length < 3 || long.length < 3) return null
  const cr = (xs: typeof timed) => xs.filter((s) => s.isClean).length / xs.length
  const a = cr(short), b = cr(long)
  if (a - b < 0.25) return null
  return { id: 'long_sessions', strength: a - b, text: `Your clean-completion rate drops from ${pct(a)} to ${pct(b)} above 50 min.` }
}

function lowEnergy(d: InsightData): Insight | null {
  const rated = d.sessions.filter((s) => s.dayEnergy !== null && s.outcome !== 'abandoned')
  const low = rated.filter((s) => s.dayEnergy! <= 2), ok = rated.filter((s) => s.dayEnergy! >= 3)
  if (low.length < 3 || ok.length < 3) return null
  const early = (xs: typeof rated) => xs.filter((s) => s.outcome === 'stopped_early').length / xs.length
  const a = early(low), b = early(ok)
  if (a < 0.2 || a < 1.5 * Math.max(b, 0.05)) return null
  return {
    id: 'low_energy', strength: a / Math.max(b, 0.1),
    text: b > 0 ? `On low-energy days (≤ 2), sessions end early ${x1(a / b)} as often.` : `On low-energy days (≤ 2), ${pct(a)} of sessions end early — on other days almost none do.`,
    action: { label: 'Plan lighter work for low days', href: '/plan' },
  }
}

function blocksByTime(d: InsightData): Insight | null {
  const scored = d.blocks.filter((b) => b.outcome !== 'released')
  const am = scored.filter((b) => b.localHour < 12), pm = scored.filter((b) => b.localHour >= 18)
  if (am.length < 3 || pm.length < 3) return null
  const kept = (xs: typeof scored) => xs.filter((b) => b.outcome === 'kept').length / xs.length
  const a = kept(am), b = kept(pm)
  if (Math.abs(a - b) < 0.25) return null
  return a > b
    ? { id: 'blocks_by_time', strength: a - b, text: `Blocks before noon: ${pct(a)} kept. After 6 pm: ${pct(b)}.`, action: { label: 'Move evening blocks to mornings?', href: '/calendar' } }
    : { id: 'blocks_by_time', strength: b - a, text: `Evening blocks: ${pct(b)} kept. Before noon: ${pct(a)}.`, action: { label: 'Put more blocks in the evening?', href: '/calendar' } }
}

function movedBlocks(d: InsightData): Insight | null {
  const moved = d.blocks.filter((b) => b.moved)
  if (moved.length < 3) return null
  const rate = moved.filter((b) => (b.score ?? 0) >= 0.75).length / moved.length
  if (rate >= 0.6) return null
  return { id: 'moved_blocks', strength: 1 - rate, text: `Moved blocks are kept only ${pct(rate)} of the time. Releasing early may be more honest.` }
}

function commitVsDeliver(d: InsightData): Insight | null {
  const g = d.goals.filter((x) => x.committed >= 120 && x.actual / x.committed < 0.75).sort((a, b) => a.actual / a.committed - b.actual / b.committed)[0]
  if (!g) return null
  const perWeekC = g.committed / g.weeks, perWeekA = g.actual / g.weeks
  const suggest = Math.max(30, Math.round(perWeekA / 30) * 30 + 30)
  return {
    id: `commit_${g.id}`, strength: 1 - g.actual / g.committed,
    text: `You commit ${h1(perWeekC)}/week to ${g.title} and deliver ${h1(perWeekA)}. Commit to ${h1(suggest)}?`,
    action: { label: 'Adjust weekly hours', href: `/goals/${g.id}` },
  }
}

function confidence(d: InsightData): Insight | null {
  if (d.forecasts.length < 4) return null
  const meanP = d.forecasts.reduce((a, f) => a + f.p, 0) / d.forecasts.length
  const hit = d.forecasts.filter((f) => f.hit).length / d.forecasts.length
  const gap = Math.round((meanP - hit) * 100)
  if (Math.abs(gap) < 15) return null
  return {
    id: 'confidence', strength: Math.abs(gap) / 100,
    text: gap > 0 ? `Your weekly goal forecasts run ${gap} points over-confident.` : `Your weekly goal forecasts run ${-gap} points under-confident — you deliver more than you expect.`,
  }
}

function cues(d: InsightData): Insight | null {
  const withCue = d.starts.filter((s) => s.hasCue), without = d.starts.filter((s) => !s.hasCue)
  if (withCue.length < 3 || without.length < 3) return null
  const a = median(without.map((s) => s.latencyDays)), b = median(withCue.map((s) => s.latencyDays))
  if (a < 0.5 || a < 2 * Math.max(b, 0.1)) return null
  return {
    id: 'cues', strength: a / Math.max(b, 0.25),
    text: b > 0.05 ? `Tasks without an if-then cue take ${x1(a / b)} longer to start.` : 'Tasks with an if-then cue get started the same day; tasks without one wait.',
    action: { label: 'Add cues to waiting tasks', href: '/aging' },
  }
}

function fillers(d: InsightData): Insight | null {
  const totals = new Map<string, number>()
  for (const r of d.recordings) for (const [w, n] of Object.entries(r.fillerBreakdown)) totals.set(w, (totals.get(w) ?? 0) + n)
  const sum = [...totals.values()].reduce((a, b) => a + b, 0)
  if (sum < 10) return null
  const [top, n] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0]!
  const share = n / sum
  if (share < 0.3) return null
  let text = `Your top filler is “${top}” (${pct(share)}).`
  const retakes = d.recordings.filter((r) => r.take >= 2 && r.fillersPerMin !== null && r.parentFillersPerMin)
  if (retakes.length >= 2) {
    const ratio = median(retakes.map((r) => r.fillersPerMin! / r.parentFillersPerMin!))
    if (ratio <= 0.6) text += ratio <= 0.55 ? ' Filler rate halves on your retakes.' : ` Retakes cut it to ${pct(ratio)}.`
  }
  return { id: 'fillers', strength: share, text, action: { label: 'Practise a drill', href: '/speak/drill?type=impromptu' } }
}

const RULES = [estimationByProject, interruptionsByTime, longSessions, lowEnergy, blocksByTime, movedBlocks, commitVsDeliver, confidence, cues, fillers]

export function computeInsights(d: InsightData): Insight[] {
  return RULES.map((r) => r(d)).filter((x): x is Insight => x !== null).sort((a, b) => b.strength - a.strength)
}
