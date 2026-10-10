import 'server-only'
import { cache } from 'react'
import { getViewer } from './viewer'
import {
  AREA_SKILL, anchorsFromBaseline, computeSkills, guideLevel, metricValuesAt, selfDirectionRate,
  type Anchors, type GuideArea, type GuideLevel, type SkillInputs, type SkillResult,
} from '@/domain/skills/skills'
import type { Viewer } from './viewer'
import { actualSecondsByTask } from './actuals'

const DAY = 86_400_000
const LOOKBACK_DAYS = 36 // 28-day window + 7-day stability check + margin

async function fetchInputs(v: Viewer, sinceDate: Date, untilDate: Date): Promise<SkillInputs & { decisions: { source: string; at: Date }[] }> {
  const { supabase } = v
  const since = sinceDate.toISOString()
  const until = untilDate.toISOString()

  const [sessRes, distRes, doneRes, startRes, dayRes, decRes, recRes, outRes] = await Promise.all([
    supabase.from('sessions').select('id, started_at, mode, planned_minutes, active_seconds, outcome, is_clean, goal_met')
      .gte('started_at', since).lt('started_at', until).not('ended_at', 'is', null),
    supabase.from('distractions').select('at, kind').gte('at', since).lt('at', until),
    supabase.from('tasks').select('id, completed_at, estimate_minutes').eq('status', 'done')
      .not('estimate_minutes', 'is', null).gte('completed_at', since).lt('completed_at', until),
    supabase.from('tasks').select('first_planned_at, first_started_at').not('first_planned_at', 'is', null).gte('first_planned_at', since).lt('first_planned_at', until),
    supabase.from('day_plans').select('closed_at, completion_rate').not('closed_at', 'is', null).gte('closed_at', since).lt('closed_at', until),
    supabase.from('decision_events').select('source, at').gte('at', since).lt('at', until),
    supabase.from('recordings').select('recorded_at, fillers_per_min, time_on_target, clarity, structure, confidence, conciseness, engagement').gte('recorded_at', since).lt('recorded_at', until),
    supabase.from('block_outcomes').select('score, calendar_blocks!inner(start_at)').gte('calendar_blocks.start_at', since).lt('calendar_blocks.start_at', until),
  ])

  const done = doneRes.data ?? []
  const secs = await actualSecondsByTask(supabase, done.map((d) => d.id))
  const actualBy = new Map([...secs].map(([id, s]) => [id, s / 60]))

  return {
    sessions: (sessRes.data ?? []).map((s) => ({
      startedAt: new Date(s.started_at), mode: s.mode, plannedMinutes: s.planned_minutes,
      activeSeconds: s.active_seconds ?? 0, outcome: (s.outcome ?? 'abandoned') as 'completed' | 'stopped_early' | 'abandoned',
      isClean: !!s.is_clean, goalMet: s.goal_met as 'yes' | 'partial' | 'no' | null,
    })).filter((s) => s.outcome !== 'abandoned'),
    distractions: (distRes.data ?? []).map((d) => ({ at: new Date(d.at), kind: d.kind as 'internal' | 'external' })),
    estimates: done
      .filter((d) => (actualBy.get(d.id) ?? 0) >= 1 && d.estimate_minutes && d.completed_at)
      .map((d) => ({ completedAt: new Date(d.completed_at!), estimate: d.estimate_minutes!, actual: actualBy.get(d.id)! })),
    starts: (startRes.data ?? []).map((s) => ({ plannedAt: new Date(s.first_planned_at!), startedAt: s.first_started_at ? new Date(s.first_started_at) : null })),
    days: (dayRes.data ?? []).filter((d) => d.completion_rate !== null).map((d) => ({ closedAt: new Date(d.closed_at!), completionRate: Number(d.completion_rate) })),
    recordings: (recRes.data ?? []).map((r) => {
      const ratings = [r.clarity, r.structure, r.confidence, r.conciseness, r.engagement].filter((x): x is number => x !== null)
      return {
        at: new Date(r.recorded_at),
        fillersPerMin: r.fillers_per_min === null ? null : Number(r.fillers_per_min),
        onTarget: r.time_on_target,
        rubricAvg: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      }
    }),
    outcomes: (outRes.data ?? []).map((o) => ({ at: new Date(o.calendar_blocks.start_at), score: o.score === null ? null : Number(o.score) })),
    decisions: (decRes.data ?? []).map((d) => ({ source: d.source, at: new Date(d.at) })),
  }
}

const ANCHOR_AFTER_DAYS = 56
const BASELINE_DAYS = 28

/**
 * Re-anchoring (DESIGN §5.2): after 8 weeks, bands are measured against your own first 4 weeks.
 * The baseline is captured once and stored; the user can switch back to fixed thresholds in Settings.
 */
async function ensureAnchors(v: Viewer): Promise<Anchors | undefined> {
  if (!v.settings.personal_bands || v.daysSinceSignup < ANCHOR_AFTER_DAYS) return undefined
  if (v.settings.skill_anchors) return v.settings.skill_anchors as Anchors
  const signup = new Date(v.profile.created_at)
  const baselineEnd = new Date(signup.getTime() + BASELINE_DAYS * DAY)
  const inputs = await fetchInputs(v, signup, baselineEnd)
  const anchors = anchorsFromBaseline(metricValuesAt(inputs, baselineEnd))
  await v.supabase.from('settings').update({ skill_anchors: anchors, anchored_at: v.now.toISOString() }).eq('owner_id', v.userId)
  return anchors
}

export const loadSkills = cache(async () => {
  const v = await getViewer()
  const { now, overrides, daysSinceSignup } = v
  const [inputs, anchors] = await Promise.all([
    fetchInputs(v, new Date(now.getTime() - LOOKBACK_DAYS * DAY), new Date(now.getTime() + 60_000)),
    ensureAnchors(v),
  ])
  const skills: SkillResult[] = computeSkills(inputs, now, anchors)

  const byId = Object.fromEntries(skills.map((s) => [s.id, s])) as Record<SkillResult['id'], SkillResult>
  const levels = Object.fromEntries(
    (Object.keys(AREA_SKILL) as GuideArea[]).map((area) => [area, guideLevel(byId[AREA_SKILL[area]].band, overrides[area] ?? 'auto')]),
  ) as Record<GuideArea, GuideLevel>

  return {
    skills,
    byId,
    levels,
    selfDirection: selfDirectionRate(inputs.decisions, now),
    anchored: !!anchors && Object.keys(anchors).length > 0,
    anchoredAt: anchors ? v.settings.anchored_at ?? now.toISOString() : null,
    calibrating: daysSinceSignup < 7,
    baselineDaysLeft: Math.max(0, 7 - daysSinceSignup),
  }
})
