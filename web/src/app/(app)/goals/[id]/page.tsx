import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getViewer } from '@/lib/data/viewer'
import { loadGoals } from '@/lib/data/goals'
import { PACE_LABEL } from '@/domain/goals/pace'
import { dayKey, weekStart } from '@/domain/time/day'
import { JourneyMap } from '@/components/goals/journey-map'
import { GoalControls } from '@/components/goals/goal-controls'
import { Button } from '@/components/ui/button'
import { fmtMinutes } from '@/lib/format'

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const v = await getViewer()
  const g = (await loadGoals()).find((x) => x.id === id)
  if (!g) notFound()

  // Promise vs reality per week (DESIGN §9.4)
  const [{ data: weekCommits }, { data: sessions }] = await Promise.all([
    v.supabase.from('commitments').select('week_start, committed_minutes').eq('level', 'week_goal').eq('goal_id', id).order('week_start'),
    v.supabase.from('sessions').select('started_at, active_seconds, tasks(project_id), calendar_blocks(goal_id)').not('ended_at', 'is', null)
      .gte('started_at', g.activatedAt ?? g.deadline ?? '2000-01-01'),
  ])
  const spentByWeek = new Map<string, number>()
  for (const s of sessions ?? []) {
    const mine = s.calendar_blocks?.goal_id === id || (!!s.tasks?.project_id && g.projectIds.includes(s.tasks.project_id))
    if (!mine) continue
    const wk = weekStart(dayKey(new Date(s.started_at), v.profile.timezone, v.profile.day_boundary_hour))
    spentByWeek.set(wk, (spentByWeek.get(wk) ?? 0) + Math.round((s.active_seconds ?? 0) / 60))
  }
  const weeks = [...new Set([...(weekCommits ?? []).map((w) => w.week_start!), ...spentByWeek.keys()])].sort().slice(-8)
  const committedBy = new Map((weekCommits ?? []).map((w) => [w.week_start!, w.committed_minutes]))
  const max = Math.max(60, ...weeks.map((w) => Math.max(committedBy.get(w) ?? 0, spentByWeek.get(w) ?? 0)))
  const lifetimeCommitted = [...committedBy.values()].reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      <Link href="/goals" className="text-sm text-muted-foreground hover:text-foreground">← Goals</Link>
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="flex-1 text-2xl font-extrabold tracking-tight">{g.title}</h1>
          <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{PACE_LABEL[g.pace.status]}</span>
        </div>
        <p className="text-sm text-muted-foreground">{g.type} · {g.targetText}{g.deadline ? ` · by ${g.deadline}` : ''}</p>
        {g.why && <p className="text-sm italic text-muted-foreground">“{g.why}”</p>}
      </header>

      <section className="rounded-2xl bg-card shadow-soft p-5">
        <JourneyMap milestones={g.milestones} progressPct={g.pace.progressPct}
          forecastLabel={g.pace.forecastFinish ? `forecast ${g.pace.forecastFinish.toISOString().slice(0, 10)}` : null} />
        <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
          <Stat label="This week" value={`${fmtMinutes(g.weekSpentMinutes)} of ${fmtMinutes(g.weeklyMinutes)} promised`} />
          <Stat label="Lifetime" value={`${fmtMinutes(g.spentMinutes)} done · ${fmtMinutes(lifetimeCommitted)} committed`} />
          {g.type !== 'process' && g.pace.requiredPerWeek !== null && <Stat label="Needed per week" value={`${Math.round(g.pace.requiredPerWeek * 10) / 10} ${g.targetUnit ?? ''}`} />}
          <Stat label="Time debt" value={g.pace.timeDebtMinutes > 0 ? fmtMinutes(g.pace.timeDebtMinutes) : 'None'} />
        </div>
      </section>

      {weeks.length > 0 && (
        <section className="space-y-2 rounded-2xl bg-card shadow-soft p-5">
          <h2 className="text-sm font-medium">Promise vs reality</h2>
          <div className="flex h-32 items-end gap-3">
            {weeks.map((w) => {
              const c = committedBy.get(w) ?? 0
              const s = spentByWeek.get(w) ?? 0
              return (
                <div key={w} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-24 w-full items-end justify-center gap-1">
                    <div className="w-3 rounded-t bg-muted-foreground/25" style={{ height: `${(c / max) * 100}%` }} title={`Committed ${fmtMinutes(c)}`} />
                    <div className={`w-3 rounded-t ${s >= c * 0.9 ? 'bg-primary' : 'bg-warning'}`} style={{ height: `${(s / max) * 100}%` }} title={`Actual ${fmtMinutes(s)}`} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{w.slice(5)}</span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">Grey = committed · colour = actual</p>
        </section>
      )}

      <section className="space-y-1 rounded-2xl bg-card shadow-soft p-5 text-sm">
        <p><span className="text-muted-foreground">Obstacle:</span> {g.obstacle ?? '—'}</p>
        <p><span className="text-muted-foreground">If-then:</span> {g.ifThen ?? '—'}</p>
      </section>

      <GoalControls goal={{ id: g.id, status: g.status, type: g.type, currentValue: g.currentValue, targetValue: g.targetValue, unit: g.targetUnit, weeklyHours: g.weeklyMinutes / 60, milestones: g.milestones }} />
      <Link href="/calendar"><Button variant="outline">Find time this week</Button></Link>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="tabular">{value}</p></div>
}
