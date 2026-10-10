import { Flag } from 'lucide-react'

/** Goal as a path (DESIGN §10.11): milestones as stations, your marker, forecast flag. */
export function JourneyMap({
  milestones, progressPct, forecastLabel, compact = false,
}: { milestones: { title: string; done: boolean }[]; progressPct: number | null; forecastLabel: string | null; compact?: boolean }) {
  const stations = milestones.length ? milestones : [{ title: 'Start', done: true }]
  const doneCount = milestones.filter((m) => m.done).length
  const pct = progressPct ?? (milestones.length ? Math.round((doneCount / milestones.length) * 100) : 0)
  return (
    <div className={compact ? 'py-2' : 'py-4'}>
      <div className="relative mx-2 h-1.5 rounded-full bg-muted">
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        {stations.map((m, i) => {
          const left = ((i + 1) / (stations.length + 1)) * 100
          return (
            <span key={i} title={m.title} className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${m.done ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-card'}`} style={{ left: `${left}%` }} />
          )
        })}
        <span className="absolute -top-1 size-3.5 -translate-x-1/2 rounded-full bg-foreground shadow ring-2 ring-card" style={{ left: `${pct}%` }} aria-label={`${pct}% there`} />
        <Flag className="absolute -right-2 -top-4 size-4 text-primary" />
      </div>
      {!compact && (
        <div className="mt-3 flex justify-between gap-2 text-[11px] text-muted-foreground">
          {stations.map((m, i) => <span key={i} className={`min-w-0 flex-1 truncate text-center ${m.done ? 'text-foreground' : ''}`}>{m.title}</span>)}
          {forecastLabel && <span className="shrink-0 text-primary">{forecastLabel}</span>}
        </div>
      )}
    </div>
  )
}
