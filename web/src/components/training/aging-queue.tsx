'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Archive, CalendarPlus, Check, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { moveTask } from '@/app/actions/tasks'
import { keepTask } from '@/app/actions/training'
import { useTaskMutation } from '@/components/tasks/task-actions'
import { ProjectDot } from '@/components/tasks/task-chips'
import type { AgingTask } from '@/lib/data/training'

/** One card at a time: decide, don't just carry it (DESIGN §13.11). */
export function AgingQueue({ tasks, onEmpty }: { tasks: AgingTask[]; onEmpty?: React.ReactNode }) {
  const [handled, setHandled] = useState<Set<string>>(new Set())
  const { pending, run } = useTaskMutation()
  const open = tasks.filter((t) => !handled.has(t.id))
  const t = open[0]
  const decide = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    run(async () => {
      const r = await fn()
      if (r.ok) setHandled((h) => new Set(h).add(t!.id))
      return r
    }, msg)

  if (!t) {
    return onEmpty ?? (
      <div className="rounded-2xl bg-card px-4 py-8 text-center shadow-soft">
        <p className="text-3xl" aria-hidden>✨</p>
        <p className="font-extrabold">All tidy.</p>
        <p className="text-sm text-muted-foreground">Nothing has been sitting untouched.</p>
      </div>
    )
  }
  return (
    <div className={`space-y-3 ${pending ? 'opacity-60' : ''}`}>
      <p className="text-xs text-muted-foreground tabular">{open.length} to decide</p>
      <div key={t.id} className="animate-settle space-y-4 rounded-2xl bg-card shadow-soft p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ProjectDot color={t.projectColor} name={t.projectName} />
            <h3 className="text-lg font-extrabold leading-snug">{t.title}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Untouched for {t.ageDays} days · in {t.status}
            {t.deferrals > 0 && ` · put off ${t.deferrals}×`}
            {t.projectName && ` · ${t.projectName}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => decide(() => keepTask(t.id), 'Kept for this week. It returns only if left untouched again.')}>
            <Check className="size-4" /> This week
          </Button>
          <Link href={`/focus?task=${t.id}&mode=starter`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm hover:bg-muted">
            <Play className="size-4" /> Starter now
          </Link>
          <Link href={`/calendar?place=${t.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm hover:bg-muted">
            <CalendarPlus className="size-4" /> Schedule
          </Link>
          <Button variant="ghost" disabled={pending} onClick={() => decide(() => moveTask({ id: t.id, to: 'someday' }), 'Parked in Someday.')}>
            <Archive className="size-4" /> Someday
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => decide(() => moveTask({ id: t.id, to: 'killed' }), 'Let go. That’s a decision, not a failure.')}>
            <Trash2 className="size-4" /> Let it go
          </Button>
        </div>
      </div>
    </div>
  )
}
