'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, Play, SlidersHorizontal } from 'lucide-react'
import { startSession } from '@/app/actions/focus'
import { setTaskDone } from '@/app/actions/tasks'
import { TaskMenu, type ProjectOption } from '@/components/tasks/task-actions'
import { fmtClock, useElapsed } from '@/lib/client/use-elapsed'
import { MODE_EMOJI, MODE_LABEL } from '@/domain/focus/session'
import { MiniDial } from '@/components/ui/mini-dial'
import { TimerSheet } from './timer-sheet'
import type { TaskView } from '@/lib/data/today'

export interface RunningView { taskId: string; startedAt: string; pausedAt: string | null; pausedSeconds: number; plannedMinutes: number | null; mode: string }

/**
 * A task as a friendly card: ▶ starts its timer right away (the suggested way), ⚙ picks another way,
 * ✓ marks it done. While it runs, the countdown shows on the card itself.
 */
export function TaskCard({ task, running, otherRunning, suggested, why, rung, projects }: {
  task: TaskView; running: RunningView | null; otherRunning: boolean; suggested: boolean; why: string | null; rung: number; projects: ProjectOption[]
}) {
  const router = useRouter()
  const [sheet, setSheet] = useState(false)
  const [pending, start] = useTransition()
  const title = task.firstAction || task.title

  const play = () => {
    if (otherRunning) return void toast('One timer at a time — finish the one that’s running first.')
    if (task.mode === 'blind') return setSheet(true) // a guess is needed first
    start(async () => {
      const r = await startSession({ taskId: task.id, mode: task.mode, suggestedMode: task.mode, goal: null, predicted: null })
      if (!r.ok) return void toast(r.error)
      router.push(`/focus?task=${task.id}`)
    })
  }

  const target = task.estimate ?? task.plannedMinutes
  const spent = task.actualMinutes

  return (
    <li className={`flex items-center gap-3 rounded-2xl bg-card px-3.5 py-3 shadow-soft transition-all duration-150 ${running ? 'ring-2 ring-primary' : ''} ${pending ? 'opacity-60' : ''}`}>
      {running ? <LiveDial r={running} spent={spent} target={target} onClick={() => router.push(`/focus?task=${task.id}`)} />
        : <span title={target ? `${spent} of ${target} min` : `${spent} min so far`}><MiniDial value={target ? spent / target : 0} size={46} text={`${spent}m`} /></span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-extrabold">{title}</p>
          {suggested && !running && <span className="shrink-0 rounded-full bg-sun-soft px-2 py-0.5 text-[11px] font-bold">✨ next up</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-muted-foreground">
          {running ? <RunningLabel r={running} /> : (
            <>
              {spent > 0 && target
                ? <span className="tabular">{spent} of {target} min{spent > target ? ' · ran over' : spent >= target * 0.8 ? ' · almost there' : ''}</span>
                : <span title={MODE_LABEL[task.mode]}>{MODE_EMOJI[task.mode]} {task.plannedMinutes ? `${task.plannedMinutes} min` : MODE_LABEL[task.mode]}</span>}
              {task.status === 'evening' && <span>🌙 evening</span>}
              {task.projectName && <span className="rounded-full bg-sky-soft px-2 py-px text-foreground/80">{task.projectName}</span>}
              {task.deferralCount >= 2 && <span className="rounded-full bg-warning-muted px-2 py-px text-warning-foreground">put off {task.deferralCount}×</span>}
              {suggested && why && <span className="truncate">· {why}</span>}
            </>
          )}
        </div>
      </div>
      {!running && (
        <>
          <button onClick={() => setSheet(true)} aria-label={`Timer options for ${title}`} title="Choose how to time it" className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><SlidersHorizontal className="size-4" /></button>
          <button onClick={() => start(async () => { const r = await setTaskDone(task.id, true); if (!r.ok) toast(r.error); else toast.success('Done 🎉'); router.refresh() })}
            aria-label={`Complete ${title}`} title="Mark done" className="rounded-xl p-2 text-muted-foreground hover:bg-leaf-soft hover:text-leaf"><Check className="size-4" /></button>
          <button onClick={play} aria-label={`Start ${title}`} disabled={pending}
            className={`flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary transition-transform duration-150 hover:scale-105 ${suggested && !otherRunning ? 'animate-pulse-ring' : ''}`}>
            <Play className="size-4 fill-current" />
          </button>
        </>
      )}
      {running && <button onClick={() => router.push(`/focus?task=${task.id}&finish=1`)} className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">✓ Done</button>}
      <TaskMenu task={task} projects={projects} />
      {sheet && <TimerSheet open onOpenChange={setSheet} task={{ id: task.id, title, estimate: task.estimate, suggestedMode: task.mode, rung }} />}
    </li>
  )
}

function useLeft(r: RunningView) {
  const elapsed = useElapsed(r.startedAt, r.pausedAt, r.pausedSeconds)
  const total = r.plannedMinutes ? r.plannedMinutes * 60 : null
  return { elapsed, total, left: total !== null ? Math.max(0, total - elapsed) : null }
}

function RunningLabel({ r }: { r: RunningView }) {
  const { elapsed, left } = useLeft(r)
  if (r.pausedAt) return <b className="text-primary">Paused</b>
  if (r.mode === 'blind') return <b className="text-primary">Running — clock hidden</b>
  return <b className="tabular text-primary">{left !== null ? `${fmtClock(left)} left` : `${fmtClock(elapsed)} so far`}</b>
}

/** The running task's dial: everything spent on it so far (past sessions + this one), ticking live. */
function LiveDial({ r, spent, target, onClick }: { r: RunningView; spent: number; target: number | null; onClick: () => void }) {
  const { elapsed, total } = useLeft(r)
  const goal = target ?? (total ? total / 60 : 60)
  const mins = spent + elapsed / 60
  return (
    <button onClick={onClick} aria-label="Open the running timer" className="shrink-0">
      <MiniDial value={r.mode === 'blind' ? 0 : mins / goal} size={46} text={r.mode === 'blind' ? '🔮' : `${Math.floor(mins)}m`} />
    </button>
  )
}
