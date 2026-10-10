'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Choice } from '@/components/ui/choice'
import { useStepKeys } from '@/lib/client/use-step-keys'
import { editTask, moveTask } from '@/app/actions/tasks'
import { useTaskMutation, type ProjectOption } from './task-actions'
import type { ListTask } from './list-row'

/** Process inbox one item at a time — full focus on a single decision (DESIGN §13.2). */
export function ProcessInbox({ tasks, projects }: { tasks: ListTask[]; projects: ProjectOption[] }) {
  const [index, setIndex] = useState(0)
  const task = tasks[index]
  const [firstAction, setFirstAction] = useState(task?.firstAction ?? task?.title ?? '')
  const [projectId, setProjectId] = useState(task?.projectId ?? '')
  const { pending, run } = useTaskMutation()
  const router = useRouter()

  const next = () => {
    const n = tasks[index + 1]
    setIndex(index + 1)
    setFirstAction(n?.firstAction ?? n?.title ?? '')
    setProjectId(n?.projectId ?? '')
  }
  const decide = (to: 'today' | 'backlog' | 'someday' | 'killed') =>
    run(async () => {
      if (!task) return { ok: true as const }
      if (projectId !== (task.projectId ?? '')) await editTask({ id: task.id, projectId: projectId || null })
      const r = await moveTask({ id: task.id, to, firstAction: to === 'today' ? firstAction : undefined })
      if (r.ok) next()
      return r
    })
  const DECISIONS = ['today', 'backlog', 'someday', 'killed'] as const
  // Enter = Today (needs a first step), 1–4 = Today / Later / Someday / Drop, Esc = home.
  useStepKeys({
    onNext: () => (task ? firstAction.trim() && !pending && decide('today') : router.push('/')),
    onPick: (i) => task && !pending && DECISIONS[i] && (DECISIONS[i] !== 'today' || firstAction.trim()) && decide(DECISIONS[i]),
    onBack: () => router.push('/'),
  })

  if (!task) {
    return (
      <div className="rounded-2xl bg-card shadow-soft p-10 text-center">
        <p className="text-lg font-medium">Inbox clear.</p>
        <p className="mt-1 text-sm text-muted-foreground">Every capture has a decision.</p>
        <Link href="/"><Button className="mt-5">Back home<Kbd>Enter ↵</Kbd></Button></Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-card shadow-soft p-6">
      <p className="text-xs text-muted-foreground tabular">{index + 1} of {tasks.length}</p>
      <h2 className="mt-2 text-xl font-semibold">{task.title}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 text-sm">
          <span className="text-muted-foreground">Project</span>
          <Choice label="Project" size="sm" value={projectId} onChange={setProjectId}
            options={[{ value: '', label: 'No project', dot: null }, ...projects.map((p) => ({ value: p.id, label: p.name, dot: p.color }))]} />
        </div>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">First step (needed for Today)</span>
          <Input value={firstAction} onChange={(e) => setFirstAction(e.target.value)} />
        </label>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button disabled={pending || !firstAction.trim()} onClick={() => decide('today')}>Today<Kbd>1 / Enter</Kbd></Button>
        <Button variant="outline" disabled={pending} onClick={() => decide('backlog')}>Later (backlog)<Kbd>2</Kbd></Button>
        <Button variant="outline" disabled={pending} onClick={() => decide('someday')}>Someday<Kbd>3</Kbd></Button>
        <Button variant="ghost" disabled={pending} onClick={() => decide('killed')}>Drop<Kbd>4</Kbd></Button>
        <button className="ml-auto text-sm text-muted-foreground hover:text-foreground" onClick={next}>Skip</button>
      </div>
    </div>
  )
}
