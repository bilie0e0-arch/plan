'use client'

import { MiniDial } from '@/components/ui/mini-dial'
import { useElapsed } from '@/lib/client/use-elapsed'
import { fmtMinutes } from '@/lib/format'

/** Today's focused time against the daily target; keeps moving while a timer runs. */
export function DayDial({ minutes, target, running }: {
  minutes: number; target: number
  running: { startedAt: string; pausedAt: string | null; pausedSeconds: number } | null
}) {
  const live = useElapsed(running?.startedAt ?? null, running?.pausedAt ?? null, running?.pausedSeconds ?? 0)
  const total = minutes + live / 60
  return (
    <div className="shrink-0" title={`${fmtMinutes(Math.floor(total))} of ${fmtMinutes(target)} focused today`} aria-label={`${fmtMinutes(Math.floor(total))} of ${fmtMinutes(target)} focused today`}>
      <MiniDial value={total / target} size={76} text={total >= 60 ? `${(total / 60).toFixed(1)}h` : `${Math.floor(total)}m`} />
    </div>
  )
}
