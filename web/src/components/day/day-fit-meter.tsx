import { fmtMinutes } from '@/lib/format'

/** Day-fit meter (DESIGN F8): planned × personal multiplier vs available time. Amber, never red. */
export function DayFitMeter({
  adjusted, available, raw, unestimated, state, large = false,
}: { adjusted: number; available: number; raw: number; unestimated: number; state: 'ok' | 'tight' | 'over'; large?: boolean }) {
  const pct = available ? Math.min(100, Math.round((adjusted / available) * 100)) : adjusted ? 100 : 0
  const label =
    state === 'ok' ? 'Fits your day' : state === 'tight' ? 'Tight — little room for surprises' : 'Doesn’t fit — move something?'
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className={state === 'ok' ? 'text-muted-foreground' : 'text-warning-foreground'}>{label}</span>
        <span className="tabular text-muted-foreground">
          ~{fmtMinutes(adjusted)} of {fmtMinutes(available)}
        </span>
      </div>
      <div className={`${large ? 'h-3' : 'h-2'} overflow-hidden rounded-full bg-muted`}>
        <div className={`h-full rounded-full transition-all ${state === 'ok' ? 'bg-primary' : 'bg-warning'}`} style={{ width: `${pct}%` }} />
      </div>
      {(raw !== adjusted || unestimated > 0) && (
        <p className="text-xs text-muted-foreground">
          {raw !== adjusted && <>You planned {fmtMinutes(raw)}; your history says ~{fmtMinutes(adjusted)}. </>}
          {unestimated > 0 && <>{unestimated} without an estimate counted as 30m.</>}
        </p>
      )}
    </div>
  )
}
