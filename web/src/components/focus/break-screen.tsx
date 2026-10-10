'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { recordBreak } from '@/app/actions/focus'
import { fmtClock } from '@/lib/format'

const ACTIVITIES = [
  'Stand up and walk for a few minutes.',
  'Drink a glass of water.',
  'Look at something far away — out of a window if you can.',
  'Stretch your neck, shoulders and back.',
  'Close your eyes and breathe slowly.',
]

/** Recovery break (DESIGN §6.2 Mode 5): non-screen suggestion, skip allowed but logged. */
export function BreakScreen({ minutes, sessionId }: { minutes: number; sessionId: string | null }) {
  const router = useRouter()
  const [left, setLeft] = useState(minutes * 60)
  const [pending, start] = useTransition()
  const activity = useMemo(() => ACTIVITIES[new Date().getMinutes() % ACTIVITIES.length], [])

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const finish = (taken: boolean) =>
    start(async () => {
      if (sessionId) await recordBreak({ afterSessionId: sessionId, suggested: minutes, taken })
      router.push('/')
      router.refresh()
    })

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-6 text-center">
      <p className="text-sm uppercase tracking-wide text-white/40">Break · {minutes} min</p>
      <p className="text-2xl font-medium leading-snug">{activity}</p>
      <p className="text-6xl font-light tabular">{fmtClock(left)}</p>
      <div className="flex w-full flex-col gap-2">
        <button disabled={pending} onClick={() => finish(true)}
          className={`h-12 rounded-xl font-medium ${left === 0 ? 'bg-teal-300 text-[oklch(0.2_0.02_185)]' : 'bg-white/10'}`}>
          {left === 0 ? 'Back to work' : 'I’m back'}
        </button>
        {sessionId && left > 0 && (
          <button disabled={pending} onClick={() => finish(false)} className="text-sm text-white/50 hover:text-white">Skip break</button>
        )}
      </div>
    </main>
  )
}
