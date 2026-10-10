import Link from 'next/link'
import { Plus } from 'lucide-react'
import { loadGoals } from '@/lib/data/goals'
import { PACE_LABEL } from '@/domain/goals/pace'
import { JourneyMap } from '@/components/goals/journey-map'
import { Button } from '@/components/ui/button'
import { fmtMinutes } from '@/lib/format'

const STATUS_STYLE = {
  ahead: 'bg-success-muted text-foreground', on_pace: 'bg-accent text-accent-foreground',
  behind: 'bg-warning-muted text-warning-foreground', at_risk: 'bg-warning-muted text-warning-foreground ring-1 ring-warning/50',
  unknown: 'bg-muted text-muted-foreground',
} as const

export default async function GoalsPage() {
  const goals = await loadGoals()
  const active = goals.filter((g) => g.status === 'active')
  const rest = goals.filter((g) => g.status !== 'active')
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Goals 🏔️</h1>
          <p className="text-sm text-muted-foreground">Big things you’re working towards — and the weekly hours you give each one.</p>
        </div>
        {goals.length > 0 && <Link href="/goals/new"><Button><Plus className="size-4" /> New goal</Button></Link>}
      </header>
      {goals.length === 0 && (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-bold">No goals yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Start with what matters most this quarter.</p>
          <Link href="/goals/new"><Button className="mt-4">Create your first goal</Button></Link>
        </div>
      )}
      <div className="grid gap-3">
        {active.map((g) => (
          <Link key={g.id} href={`/goals/${g.id}`} className="block rounded-2xl bg-card shadow-soft p-5 hover:border-primary/40">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex-1 font-medium">{g.title}</h2>
              <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[g.pace.status]}`}>{PACE_LABEL[g.pace.status]}</span>
            </div>
            <p className="text-sm text-muted-foreground">{g.targetText}{g.deadline ? ` · by ${g.deadline}` : ''}</p>
            <JourneyMap compact milestones={g.milestones} progressPct={g.pace.progressPct} forecastLabel={null} />
            <p className="text-xs text-muted-foreground tabular">
              This week {fmtMinutes(g.weekSpentMinutes)} of {fmtMinutes(g.weeklyMinutes)} promised · {fmtMinutes(g.weekPlannedMinutes)} on the calendar
              {g.pace.forecastFinish && ` · forecast ${g.pace.forecastFinish.toISOString().slice(0, 10)}`}
            </p>
          </Link>
        ))}
      </div>
      {rest.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Drafts, paused & done</h2>
          {rest.map((g) => (
            <Link key={g.id} href={`/goals/${g.id}`} className="flex items-center justify-between rounded-2xl bg-card shadow-soft px-4 py-3 text-sm hover:bg-muted">
              <span>{g.title}</span><span className="text-xs text-muted-foreground">{g.status}</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}
