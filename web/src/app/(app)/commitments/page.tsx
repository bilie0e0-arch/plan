import Link from 'next/link'
import { getViewer } from '@/lib/data/viewer'
import { finalizeOutcomes } from '@/lib/data/calendar'
import { loadGoals } from '@/lib/data/goals'
import { localDayMinute } from '@/domain/time/day'
import { reliability } from '@/domain/calendar/blocks'
import { fmtMinutes } from '@/lib/format'
import { fetchAll } from '@/lib/supabase/paging'

const OUTCOMES = [
  { id: 'kept', label: 'Kept', cls: 'bg-success' },
  { id: 'shortened', label: 'Shortened', cls: 'bg-warning' },
  { id: 'moved', label: 'Moved', cls: 'bg-warning/60' },
  { id: 'released', label: 'Released', cls: 'bg-muted-foreground/30' },
  { id: 'missed', label: 'Missed', cls: 'border border-muted-foreground/50' },
] as const
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default async function CommitmentsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period = 'month' } = await searchParams
  const v = await getViewer()
  await finalizeOutcomes(v)
  const days = period === 'week' ? 7 : period === 'all' ? 3650 : 28
  const since = new Date(v.now.getTime() - days * 86_400_000).toISOString()
  const [rows, goals] = await Promise.all([
    fetchAll((a, b) => v.supabase.from('block_outcomes').select('block_id, outcome, score, minutes_late, actual_minutes, calendar_blocks!inner(start_at, end_at)')
      .gte('calendar_blocks.start_at', since).order('block_id').range(a, b)),
    loadGoals(),
  ])
  const counts = Object.fromEntries(OUTCOMES.map((o) => [o.id, rows.filter((r) => r.outcome === o.id).length])) as Record<string, number>
  const rel = reliability(rows.map((r) => ({ score: r.score === null ? null : Number(r.score) })))
  const lates = rows.filter((r) => r.minutes_late !== null).map((r) => r.minutes_late!).sort((a, b) => a - b)
  const medianLate = lates.length ? lates[Math.floor(lates.length / 2)] : null
  const committedMin = rows.filter((r) => r.outcome !== 'released').reduce((a, r) => a + Math.round((new Date(r.calendar_blocks.end_at).getTime() - new Date(r.calendar_blocks.start_at).getTime()) / 60_000), 0)
  const actualMin = rows.reduce((a, r) => a + r.actual_minutes, 0)

  // Heatmap: kept-rate by weekday × hour (where your promises hold)
  const grid = new Map<string, { kept: number; total: number }>()
  for (const r of rows) {
    if (r.outcome === 'released') continue
    const start = new Date(r.calendar_blocks.start_at)
    const { minute } = localDayMinute(start, v.profile.timezone)
    const dow = (new Date(new Intl.DateTimeFormat('en-CA', { timeZone: v.profile.timezone }).format(start) + 'T00:00:00Z').getUTCDay() + 6) % 7
    const key = `${dow}:${Math.floor(minute / 60)}`
    const cur = grid.get(key) ?? { kept: 0, total: 0 }
    cur.total++
    if (r.outcome === 'kept') cur.kept++
    grid.set(key, cur)
  }
  const hours = Array.from({ length: v.settings.day_end_hour - v.settings.day_start_hour }, (_, i) => v.settings.day_start_hour + i)

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">My promises 🤞</h1>
          <p className="text-sm text-muted-foreground">What you promised yourself — and what actually happened.</p>
        </div>
        <div className="flex gap-1 rounded-lg border p-0.5 text-sm">
          {['week', 'month', 'all'].map((p) => (
            <Link key={p} href={`/commitments?period=${p}`} className={`rounded-md px-3 py-1 capitalize ${p === period ? 'bg-muted font-medium' : 'text-muted-foreground'}`}>{p}</Link>
          ))}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card label="Reliability (kept-rate)" value={rel === null ? '—' : `${rel}%`} hint={rel === null ? 'Needs 5 finished committed blocks' : 'Released blocks excluded'} />
        <Card label="Committed → actual" value={`${fmtMinutes(committedMin)} → ${fmtMinutes(actualMin)}`} hint={committedMin ? `${Math.round((actualMin / committedMin) * 100)}% time fidelity` : ''} />
        <Card label="Median start" value={medianLate === null ? '—' : medianLate === 0 ? 'On time' : `${medianLate} min late`} hint="From block start to first session" />
      </section>

      <section className="space-y-2 rounded-2xl bg-card shadow-soft p-5">
        <h2 className="text-sm font-medium">Outcomes</h2>
        <div className="flex h-3 overflow-hidden rounded-full bg-muted">
          {OUTCOMES.map((o) => counts[o.id] ? <div key={o.id} className={o.cls} style={{ width: `${(counts[o.id]! / Math.max(1, rows.length)) * 100}%` }} title={`${o.label}: ${counts[o.id]}`} /> : null)}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {OUTCOMES.map((o) => <span key={o.id} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-sm ${o.cls}`} />{o.label} {counts[o.id]}</span>)}
        </div>
      </section>

      <section className="space-y-2 rounded-2xl bg-card shadow-soft p-5">
        <h2 className="text-sm font-medium">Goals this week</h2>
        {goals.filter((g) => g.status === 'active').length === 0 && <p className="text-sm text-muted-foreground">No active goals.</p>}
        {goals.filter((g) => g.status === 'active').map((g) => {
          const pct = g.weeklyMinutes ? Math.min(100, (g.weekSpentMinutes / g.weeklyMinutes) * 100) : 0
          return (
            <Link key={g.id} href={`/goals/${g.id}`} className="block space-y-1 rounded-lg px-1 py-1 hover:bg-muted">
              <div className="flex justify-between text-sm"><span>{g.title}</span><span className="tabular text-muted-foreground">{fmtMinutes(g.weekSpentMinutes)} / {fmtMinutes(g.weeklyMinutes)}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${pct >= 75 ? 'bg-primary' : 'bg-warning'}`} style={{ width: `${pct}%` }} /></div>
            </Link>
          )
        })}
      </section>

      <section className="space-y-2 rounded-2xl bg-card shadow-soft p-5">
        <h2 className="text-sm font-medium">Where your promises hold</h2>
        {grid.size === 0 ? <p className="text-sm text-muted-foreground">Appears after a few committed blocks finish.</p> : (
          <div className="overflow-x-auto">
            <table className="text-[10px] text-muted-foreground">
              <thead><tr><th />{hours.map((h) => <th key={h} className="w-6 font-normal">{h}</th>)}</tr></thead>
              <tbody>
                {DOW.map((d, di) => (
                  <tr key={d}>
                    <td className="pr-2">{d}</td>
                    {hours.map((h) => {
                      const c = grid.get(`${di}:${h}`)
                      const rate = c ? c.kept / c.total : null
                      return <td key={h}><div className="m-0.5 size-5 rounded" title={c ? `${Math.round(rate! * 100)}% kept (${c.total})` : ''}
                        style={{ background: rate === null ? 'var(--muted)' : `color-mix(in oklch, var(--primary) ${Math.round(rate * 100)}%, var(--warning-muted))` }} /></td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Card({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl bg-card shadow-soft p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
