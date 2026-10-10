'use client'

import Link from 'next/link'
import { Play, Lightbulb, Zap } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { setTaskDone } from '@/app/actions/tasks'
import { TaskMenu, useTaskMutation, type ProjectOption } from './task-actions'
import { Chip, EstimateChip, ModeChip, ProjectDot } from './task-chips'
import type { TaskView } from '@/lib/data/today'

export function TodayRow({ task, projects, showMode }: { task: TaskView; projects: ProjectOption[]; showMode: boolean }) {
  const { pending, run } = useTaskMutation()
  return (
    <li className={`group flex items-center gap-3 px-3 py-2.5 transition-opacity ${pending ? 'opacity-50' : ''}`}>
      <Checkbox aria-label={`Complete ${task.title}`} checked={false}
        onCheckedChange={() => run(() => setTaskDone(task.id, true), 'Done.')} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <ProjectDot color={task.projectColor} name={task.projectName} />
          <span className="truncate">{task.firstAction || task.title}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {task.firstAction && task.firstAction !== task.title && <span className="mr-1 truncate text-xs text-muted-foreground">{task.title}</span>}
          <EstimateChip estimate={task.estimate} adjusted={task.adjustedEstimate} />
          {task.energy && <Chip>{task.energy}</Chip>}
          {showMode && <ModeChip mode={task.mode} minutes={task.plannedMinutes} />}
          {task.deferralCount >= 2 && <Chip tone="warning">put off {task.deferralCount}×</Chip>}
          {task.ifThenTrigger && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="If-then cue"><Zap className="size-3" />{task.ifThenMinute != null && `${String(Math.floor(task.ifThenMinute / 60)).padStart(2, '0')}:${String(task.ifThenMinute % 60).padStart(2, '0')} · `}{task.ifThenTrigger}</span>}
          {task.doneWhen && <span className="text-xs text-muted-foreground">done when: {task.doneWhen}</span>}
          {task.reentryNote && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lightbulb className="size-3" />{task.reentryNote}</span>}
        </div>
      </div>
      <Link href={`/focus?task=${task.id}`} aria-label={`Start ${task.title}`}
        className="flex size-8 items-center justify-center rounded-full text-primary opacity-70 hover:bg-accent hover:opacity-100 group-hover:opacity-100">
        <Play className="size-4" />
      </Link>
      <TaskMenu task={task} projects={projects} />
    </li>
  )
}
