'use client'

import { ArrowRight, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { moveTask } from '@/app/actions/tasks'
import { PlanGateDialog, TaskMenu, useTaskMutation, type ProjectOption, type TaskLite } from './task-actions'
import { Chip, ProjectDot } from './task-chips'

export interface ListTask extends TaskLite {
  projectName: string | null
  projectColor: string | null
  createdAt: string
  kind: string
}

/** Row for Inbox / Someday / Backlog lists, with one-tap triage. */
export function ListRow({ task, projects }: { task: ListTask; projects: ProjectOption[] }) {
  const [gate, setGate] = useState<null | 'today' | 'evening'>(null)
  const { pending, run } = useTaskMutation()
  const toToday = (to: 'today' | 'evening') => run(() => moveTask({ id: task.id, to }), to === 'today' ? 'Added to Today ☀️' : 'Added to this evening 🌙')
  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 ${pending ? 'opacity-50' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <ProjectDot color={task.projectColor} name={task.projectName} />
          <span className="truncate">{task.title}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {task.estimate && <Chip>{task.estimate}m</Chip>}
          {task.energy && <Chip>{task.energy}</Chip>}
          {task.kind === 'speak' && <Chip>speak</Chip>}
          {task.hiddenUntil && <Chip>back {new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${task.hiddenUntil}T00:00:00Z`))}</Chip>}
        </div>
      </div>
      <button onClick={() => toToday('today')} title="Move to Today" className="hidden items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground sm:flex">
        <Sun className="size-3.5" /> Today
      </button>
      <button onClick={() => toToday('evening')} title="Move to Evening" className="hidden rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground sm:block">
        <Moon className="size-3.5" />
      </button>
      {task.status === 'inbox' && (
        <button onClick={() => run(() => moveTask({ id: task.id, to: 'backlog' }), 'Moved to backlog.')} title="Keep for later (backlog)"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <ArrowRight className="size-3.5" />
        </button>
      )}
      <TaskMenu task={task} projects={projects} />
      {gate && <PlanGateDialog task={task} to={gate} open onOpenChange={(o) => !o && setGate(null)} />}
    </li>
  )
}
