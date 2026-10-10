'use client'

import { useEffect, useState } from 'react'

/** Elapsed active seconds derived from timestamps, so throttled tabs and sleep never drift. */
export function useElapsed(startedAt: string | null, pausedAt: string | null, pausedSeconds: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt || pausedAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startedAt, pausedAt])
  if (!startedAt) return 0
  const end = pausedAt ? new Date(pausedAt).getTime() : Math.max(now, new Date(startedAt).getTime())
  return Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000) - pausedSeconds)
}

export { fmtClock, fmtMinutes } from '@/lib/format'
