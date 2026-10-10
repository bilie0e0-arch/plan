'use client'

import Link from 'next/link'
import { Pause } from 'lucide-react'
import { MiniDial } from '@/components/ui/mini-dial'
import { fmtClock, useElapsed } from '@/lib/client/use-elapsed'
import type { OpenSessionView } from './types'

/** The running timer, always visible at the top of every screen (UI v0.6) — never running out of sight. */
export function TimerBar({ session }: { session: OpenSessionView }) {
  const elapsed = useElapsed(session.startedAt, session.pausedAt, session.pausedSeconds)
  const blind = session.mode === 'blind'
  const remaining = session.plannedMinutes ? session.plannedMinutes * 60 - elapsed : null
  const label = session.pausedAt ? 'Paused' : blind ? 'Running' : remaining !== null ? fmtClock(Math.max(0, remaining)) : fmtClock(elapsed)
  return (
    <div role="status" aria-label="Running timer"
      className="sticky top-0 z-30 -mx-4 -mt-14 mb-5 flex items-center gap-3 bg-primary py-1.5 pl-4 pr-24 font-bold text-primary-foreground shadow-soft animate-rise md:-mx-10 md:-mt-7 md:px-10">
      {session.pausedAt ? <Pause className="size-4" /> : <MiniDial value={blind ? 0 : session.plannedMinutes ? elapsed / (session.plannedMinutes * 60) : (elapsed % 3600) / 3600} size={34} tone="light" />}
      <span className="min-w-0 flex-1 truncate">{session.taskTitle}</span>
      <span className="tabular rounded-full bg-white/20 px-3 py-1 text-sm">{label}</span>
      <Link href={`/focus?task=${session.taskId}`} className="rounded-full bg-white/20 px-3 py-1 text-sm hover:bg-white/30">Open</Link>
      <Link href={`/focus?task=${session.taskId}&finish=1`} className="rounded-full bg-white/20 px-3 py-1 text-sm hover:bg-white/30">✓ Done</Link>
    </div>
  )
}
