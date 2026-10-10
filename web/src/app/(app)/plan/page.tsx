import { getViewer } from '@/lib/data/viewer'
import { loadToday, loadMultiplierSamples } from '@/lib/data/today'
import { loadSkills } from '@/lib/data/skills'
import { loadList, loadProjectOptions } from '@/lib/data/lists'
import { addDays, dayRange } from '@/domain/time/day'
import { personalMultiplier } from '@/domain/plan/time-honesty'
import { PlanWizard, type Candidate } from '@/components/day/plan-wizard'

export default async function PlanPage() {
  const v = await getViewer()
  const [t, s, backlog, inbox, projects, samples] = await Promise.all([
    loadToday(), loadSkills(), loadList('backlog'), loadList('inbox'), loadProjectOptions(), loadMultiplierSamples(),
  ])
  const y = dayRange(addDays(v.today, -1), v.profile.timezone, v.profile.day_boundary_hour)
  const { count: yesterdayDone } = await v.supabase.from('tasks').select('id', { count: 'exact', head: true })
    .eq('status', 'done').gte('completed_at', y.start.toISOString()).lt('completed_at', y.end.toISOString())

  const behind = new Set(t.budgets.filter((b) => b.status === 'active' && b.drift?.underServed).map((b) => b.id))
  const deficit = new Map(t.budgets.map((b) => [b.id, b.weekly_budget_minutes > 0 ? 1 - (b.drift?.pace ?? 1) : 0]))
  const candidates: Candidate[] = [...backlog, ...inbox]
    .map((c) => ({
      id: c.id, title: c.title, firstAction: c.firstAction, estimate: c.estimate, energy: c.energy,
      projectId: c.projectId, projectName: c.projectName, projectColor: c.projectColor,
      behind: !!c.projectId && behind.has(c.projectId),
      multiplier: personalMultiplier(samples, c.projectId, c.energy).value,
      fromInbox: c.status === 'inbox',
    }))
    .sort((a, b) => (deficit.get(b.projectId ?? '') ?? 0) - (deficit.get(a.projectId ?? '') ?? 0))

  return (
    <PlanWizard
      level={s.levels.morning_ritual}
      tone={v.tone}
      energy={t.plan?.energy ?? null}
      sleepHours={t.plan?.sleep_hours != null ? Number(t.plan.sleep_hours) : null}
      dayPlanned={t.dayPlanned}
      yesterdayDone={yesterdayDone ?? 0}
      leftovers={t.leftovers.map((x) => ({ id: x.id, title: x.firstAction || x.title, deferralCount: x.deferralCount }))}
      today={[...t.main, ...t.evening].filter((x) => !x.leftover).map((x) => ({
        id: x.id, title: x.firstAction || x.title, estimate: x.estimate, adjusted: x.adjustedEstimate, evening: x.status === 'evening', projectColor: x.projectColor,
      }))}
      candidates={candidates}
      projects={projects}
      wipCap={v.settings.wip_cap}
      fit={t.fit}
      defaultAvailable={t.plan?.available_minutes ?? v.settings.default_available_minutes}
    />
  )
}
