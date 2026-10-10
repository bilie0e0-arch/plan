import 'server-only'
import { getViewer } from './viewer'
import { loadSkills } from './skills'
import { loadGoals } from './goals'
import { loadWeek } from './calendar'
import { loadAging, loadGoalWeeks, loadInsights, loadMissions, weekRange } from './training'
import { reviewWeeks } from '@/domain/training/week'
import { suggestMissionSkill } from '@/domain/training/missions'
import { commitmentSuggestion, type LadderSuggestion } from '@/domain/training/commitments'
import { RECORDS, type RecordType } from '@/domain/training/records'
import { PACE_LABEL } from '@/domain/goals/pace'
import { reliability } from '@/domain/calendar/blocks'
import { fmtMinutes } from '@/lib/format'

export interface WrappedCard {
  id: string
  eyebrow: string
  headline: string
  body?: string
  compare?: { before: string; after: string; better: boolean | null }
}

const fmtDate = (key: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${key}T00:00:00Z`))

export async function loadReview() {
  const v = await getViewer()
  const { planWeek, reviewedWeek } = reviewWeeks(v.today)
  const r = weekRange(v, reviewedWeek)
  const [review, skills, goals, goalWeeks, insights, pastMissions, planMissions, aging, week, outcomesRes, sessRes, blockRes, recordsRes, firstRecs, lastRecs] = await Promise.all([
    v.supabase.from('reviews').select('step, closed_at').eq('week_start', planWeek).maybeSingle(),
    loadSkills(),
    loadGoals(),
    loadGoalWeeks(4, planWeek),
    loadInsights(),
    loadMissions(reviewedWeek),
    loadMissions(planWeek),
    loadAging(),
    loadWeek(planWeek),
    v.supabase.from('outcomes').select('id, week_start, text, sort_order, result').in('week_start', [reviewedWeek, planWeek]).order('sort_order'),
    v.supabase.from('sessions').select('active_seconds, is_clean, started_at, tasks(title)').gte('started_at', r.start.toISOString()).lt('started_at', r.end.toISOString()).not('ended_at', 'is', null),
    v.supabase.from('block_outcomes').select('outcome, score, actual_minutes, calendar_blocks!inner(start_at, title)').gte('calendar_blocks.start_at', r.start.toISOString()).lt('calendar_blocks.start_at', r.end.toISOString()),
    v.supabase.from('personal_records').select('record_type, value, previous_value, achieved_at').gte('achieved_at', r.start.toISOString()).lt('achieved_at', r.end.toISOString()),
    v.supabase.from('recordings').select('recorded_at, fillers_per_min').not('fillers_per_min', 'is', null).order('recorded_at').limit(1),
    v.supabase.from('recordings').select('recorded_at, fillers_per_min').not('fillers_per_min', 'is', null).order('recorded_at', { ascending: false }).limit(1),
  ])

  // ───── Week Wrapped (DESIGN §13.20) ─────
  const sessions = sessRes.data ?? []
  const focusMin = Math.round(sessions.reduce((a, s) => a + (s.active_seconds ?? 0), 0) / 60)
  const blocks = blockRes.data ?? []
  const kept = reliability(blocks.map((b) => ({ score: b.score === null ? null : Number(b.score) })))
  const cards: WrappedCard[] = []
  const range = `${fmtDate(reviewedWeek)} – ${fmtDate(new Date(new Date(`${reviewedWeek}T00:00:00Z`).getTime() + 6 * 86_400_000).toISOString().slice(0, 10))}`
  if (kept !== null) {
    const counts = blocks.reduce((m, b) => m.set(b.outcome, (m.get(b.outcome) ?? 0) + 1), new Map<string, number>())
    cards.push({ id: 'number', eyebrow: `Your week in one number · ${range}`, headline: `${kept}% kept`, body: `${counts.get('kept') ?? 0} kept · ${counts.get('shortened') ?? 0} shortened · ${counts.get('missed') ?? 0} missed · ${fmtMinutes(focusMin)} focused` })
  } else {
    cards.push({ id: 'number', eyebrow: `Your week in one number · ${range}`, headline: fmtMinutes(focusMin), body: focusMin ? `focused across ${sessions.filter((s) => (s.active_seconds ?? 0) >= 120).length} sessions` : 'A quiet week. This review is where the next one starts.' })
  }
  const best = [...sessions].filter((s) => s.is_clean).sort((a, b) => (b.active_seconds ?? 0) - (a.active_seconds ?? 0))[0]
  const bestBlock = [...blocks].filter((b) => b.outcome === 'kept').sort((a, b) => b.actual_minutes - a.actual_minutes)[0]
  if (bestBlock) cards.push({ id: 'best', eyebrow: 'Best block', headline: bestBlock.calendar_blocks.title, body: `${bestBlock.actual_minutes} minutes, kept as promised.` })
  else if (best) cards.push({ id: 'best', eyebrow: 'Best session', headline: best.tasks?.title ?? 'Focus session', body: `${Math.round((best.active_seconds ?? 0) / 60)} minutes clean.` })
  const pr = (recordsRes.data ?? [])[0]
  if (pr) {
    const d = RECORDS[pr.record_type as RecordType]
    cards.push({ id: 'pr', eyebrow: 'Personal record', headline: `${d.label}: ${d.fmt(Number(pr.value))}`, body: pr.previous_value !== null ? `Previous best ${d.fmt(Number(pr.previous_value))}.` : undefined })
  }
  if (insights[0]) cards.push({ id: 'pattern', eyebrow: 'A pattern you might not know', headline: insights[0].text })
  const first = firstRecs.data?.[0], last = lastRecs.data?.[0]
  if (first && last && first.recorded_at !== last.recorded_at) {
    const a = Number(first.fillers_per_min), b = Number(last.fillers_per_min)
    cards.push({ id: 'then_now', eyebrow: 'Then vs now · speaking', headline: 'Fillers per minute', compare: { before: String(a), after: String(b), better: b < a ? true : b > a ? false : null } })
  } else {
    const s1 = skills.byId.S1
    if (s1.value !== null && s1.previousValue !== null) {
      cards.push({ id: 'then_now', eyebrow: 'Then vs now · focus capacity', headline: 'Longest reliable session', compare: { before: `${s1.previousValue}m`, after: `${s1.value}m`, better: s1.value > s1.previousValue ? true : s1.value < s1.previousValue ? false : null } })
    }
  }
  const main = pastMissions.find((m) => m.kind === 'main')
  if (main) {
    cards.push({
      id: 'mission', eyebrow: 'Mission result', headline: `${main.done ? 'Complete' : 'Not quite'} — ${main.progress} / ${main.target} ${main.unit}`,
      body: main.title,
    })
  }
  const suggested = suggestMissionSkill(skills.skills)
  cards.push({ id: 'next', eyebrow: 'Next week’s mission (suggested)', headline: skills.byId[suggested].name, body: 'Weakest trend right now. You choose in step 5.' })

  // ───── Goals: committed vs actual, pace, forecast, Commitment Ladder ─────
  const active = goals.filter((g) => g.status === 'active')
  const { data: conf } = await v.supabase.from('goal_confidence').select('goal_id, confidence_pct').eq('week_start', planWeek)
  const plannedByGoal = new Map<string, number>()
  for (const b of week.blocks) {
    if (!b.goalId) continue
    plannedByGoal.set(b.goalId, (plannedByGoal.get(b.goalId) ?? 0) + Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000))
  }
  const goalRows = active.map((g) => {
    const gw = goalWeeks.find((x) => x.id === g.id)
    const weeks = gw?.weeks ?? []
    const lastWeek = weeks.find((w) => w.week === reviewedWeek) ?? null
    // Only finished weeks calibrate commitments (a Friday review must not judge the week in progress).
    const suggestion: LadderSuggestion | null = commitmentSuggestion(g.title, weeks.filter((w) => w.complete), g.weeklyMinutes)
    let paceNote: string | null = null
    if ((g.pace.status === 'behind' || g.pace.status === 'at_risk') && g.pace.forecastFinish && g.deadline) {
      const m = (d: Date) => new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(d)
      paceNote = `At this pace, ${g.title} forecasts for ${m(g.pace.forecastFinish)}, not ${m(new Date(g.deadline))}. Raise hours, move the date, or adjust the target?`
    }
    return {
      id: g.id, title: g.title, pace: PACE_LABEL[g.pace.status], paceStatus: g.pace.status, weeklyMinutes: g.weeklyMinutes,
      lastWeek: lastWeek ? { committed: lastWeek.committed, actual: lastWeek.actual, confidence: lastWeek.confidence, complete: lastWeek.complete } : null,
      history: weeks.map((w) => ({ week: w.week, committed: w.committed, actual: w.actual })),
      confidence: conf?.find((c) => c.goal_id === g.id)?.confidence_pct ?? null,
      suggestion, paceNote, plannedMinutes: plannedByGoal.get(g.id) ?? 0,
    }
  })

  const outcomes = outcomesRes.data ?? []
  return {
    planWeek, reviewedWeek, step: review.data?.step ?? 1, closed: !!review.data?.closed_at,
    cards,
    gradeOutcomes: outcomes.filter((o) => o.week_start === reviewedWeek).map((o) => ({ id: o.id, text: o.text, result: o.result as 'met' | 'partial' | 'missed' | null })),
    planOutcomes: [0, 1, 2].map((i) => outcomes.find((o) => o.week_start === planWeek && o.sort_order === i)?.text ?? ''),
    goals: goalRows,
    pastMissions, planMissions,
    skills: skills.skills.map((s) => ({ id: s.id, name: s.name, band: s.band, display: s.display, trend: s.trend, needs: s.needs })),
    suggested,
    aging,
    plan: { freeMinutes: week.freeMinutes, plannedMinutes: week.plannedMinutes, committed: week.weekCommitted, blockCount: week.blocks.filter((b) => b.type !== 'fixed').length },
  }
}

export type ReviewData = Awaited<ReturnType<typeof loadReview>>
