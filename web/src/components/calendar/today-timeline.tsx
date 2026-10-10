'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { localDayMinute } from '@/domain/time/day'

/** Horizontal strip of today's blocks with a current-time marker (DESIGN §13.4). */
export function TodayTimeline({ blocks, startHour, endHour, timeZone }: {
  blocks: { id: string; title: string; type: string; minute: number; minutes: number; outcome: string | null; started: boolean }[]
  startHour: number; endHour: number; timeZone: string
}) {
  const span = (endHour - startHour) * 60
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(localDayMinute(new Date(), timeZone).minute)
    tick()
    const t = setInterval(tick, 60_000)
    return () => clearInterval(t)
  }, [timeZone])
  const pos = (m: number) => `${Math.min(100, Math.max(0, ((m - startHour * 60) / span) * 100))}%`

  return (
    <section aria-label="Today's blocks" className="space-y-1">
      <div className="relative h-11 overflow-hidden rounded-2xl bg-card shadow-soft">
        {blocks.map((b) => {
          const style = b.type === 'fixed' ? 'bg-muted text-muted-foreground'
            : b.outcome === 'kept' ? 'bg-success-muted' : b.outcome === 'missed' ? 'border border-border bg-transparent text-muted-foreground'
              : 'bg-primary/15'
          const href = b.type === 'fixed' ? '/calendar' : b.type === 'speaking' ? `/speak/drill?block=${b.id}` : `/launch/${b.id}`
          return (
            <Link key={b.id} href={href} title={b.title}
              className={`absolute inset-y-1.5 overflow-hidden rounded-md px-1.5 text-[11px] leading-8 ${style}`}
              style={{ left: pos(b.minute), width: `calc(${pos(b.minute + b.minutes)} - ${pos(b.minute)})` }}>
              <span className="truncate">{b.title}</span>
            </Link>
          )
        })}
        {now !== null && now >= startHour * 60 && now <= endHour * 60 && (
          <span className="absolute inset-y-0 w-0.5 bg-primary" style={{ left: pos(now) }} />
        )}
      </div>
      <div className="flex justify-between px-1 text-[10px] text-muted-foreground">
        <span>{String(startHour).padStart(2, '0')}:00</span>
        <Link href="/calendar" className="hover:text-foreground">Calendar →</Link>
        <span>{String(endHour).padStart(2, '0')}:00</span>
      </div>
    </section>
  )
}
