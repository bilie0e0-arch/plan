'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { chime } from '@/lib/client/chime'

const WINDOW_MIN = 120

/** "Next: Writing in 12 min" — time passing made visible (Structured/Tiimo idea), with one soft chime at 5 minutes. */
export function NextUp({ id, title, startIso, sound }: { id: string; title: string; startIso: string; sound: boolean }) {
  const start = new Date(startIso).getTime()
  const [now, setNow] = useState(() => Date.now())
  const chimed = useRef(false)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])
  const minutes = Math.max(0, Math.ceil((start - now) / 60_000))
  useEffect(() => {
    if (minutes <= 5 && !chimed.current && sound && !document.hidden) {
      chimed.current = true
      chime()
    }
  }, [minutes, sound])
  const R = 9
  const C = 2 * Math.PI * R
  const left = Math.min(1, minutes / WINDOW_MIN)
  return (
    <Link href={`/launch/${id}`} className="flex items-center gap-3 rounded-2xl bg-card/70 shadow-soft px-4 py-2.5 text-sm hover:bg-muted">
      <svg viewBox="0 0 24 24" className="size-6 -rotate-90" aria-hidden>
        <circle cx="12" cy="12" r={R} className="fill-none stroke-muted" strokeWidth="3" />
        <circle cx="12" cy="12" r={R} className="fill-none stroke-primary transition-[stroke-dashoffset] duration-500" strokeWidth="3"
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - left)} />
      </svg>
      <span className="flex-1">Next: <b>{title}</b> in {minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`}</span>
      <span className="text-muted-foreground">Open</span>
    </Link>
  )
}
