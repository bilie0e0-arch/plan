'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createProject, updateProject } from '@/app/actions/projects'
import { useTaskMutation } from '@/components/tasks/task-actions'
import { PROJECT_COLORS } from '@/domain/projects/colors'
import { fmtMinutes } from '@/lib/format'

export interface ProjectCard {
  id: string
  name: string
  color: string
  status: string
  budgetMinutes: number
  actualMinutes: number
  pace: number | null
  underServed: boolean
  openTasks: number
  multiplier: number | null
}

export function NewProjectForm() {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>('teal')
  const [hours, setHours] = useState('3')
  const { pending, run } = useTaskMutation()
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-2xl bg-card shadow-soft p-3"
      onSubmit={(e) => {
        e.preventDefault()
        run(async () => {
          const r = await createProject({ name, color, weeklyHours: Number(hours) || 0 })
          if (r.ok) setName('')
          return r
        }, 'Project created.')
      }}
    >
      <label className="min-w-40 flex-1 space-y-1 text-sm">
        <span className="text-muted-foreground">New project</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spanish, Biology, Guitar" required />
      </label>
      <label className="w-28 space-y-1 text-sm">
        <span className="text-muted-foreground">Hours / week</span>
        <Input inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value.replace(/[^\d.]/g, ''))} />
      </label>
      <div className="flex items-center gap-1 pb-1.5">
        {PROJECT_COLORS.map((c) => (
          <button type="button" key={c} aria-label={c} onClick={() => setColor(c)}
            className={`size-5 rounded-full ring-offset-2 ring-offset-card ${color === c ? 'ring-2 ring-foreground/40' : ''}`}
            style={{ background: `var(--project-${c})` }} />
        ))}
      </div>
      <Button type="submit" disabled={pending || !name.trim()}>Add</Button>
    </form>
  )
}

export function ProjectCardView({ p }: { p: ProjectCard }) {
  const { pending, run } = useTaskMutation()
  const [editing, setEditing] = useState(false)
  const [hours, setHours] = useState(String(p.budgetMinutes / 60))
  const pct = p.budgetMinutes ? Math.min(100, Math.round((p.actualMinutes / p.budgetMinutes) * 100)) : 0
  const active = p.status === 'active'
  return (
    <div className={`rounded-2xl bg-card shadow-soft p-4 ${pending ? 'opacity-60' : ''} ${active ? '' : 'opacity-70'}`}>
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ background: `var(--project-${p.color})` }} />
        <h3 className="flex-1 font-medium">{p.name}</h3>
        <span className="text-xs text-muted-foreground">{p.status}</span>
      </div>
      {p.budgetMinutes > 0 ? (
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground tabular">
            <span>{fmtMinutes(p.actualMinutes)} of {fmtMinutes(p.budgetMinutes)} this week</span>
            {p.underServed && <span className="text-warning-foreground">under-served</span>}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${p.underServed ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No weekly budget set.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{p.openTasks} open task{p.openTasks === 1 ? '' : 's'}</span>
        {p.multiplier && p.multiplier !== 1 && <span>runs {p.multiplier}× your estimates</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        {editing ? (
          <>
            <Input className="h-8 w-20" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value.replace(/[^\d.]/g, ''))} />
            <span className="text-xs text-muted-foreground">h / week</span>
            <Button size="sm" onClick={() => run(async () => {
              const r = await updateProject({ id: p.id, weeklyHours: Number(hours) || 0 })
              if (r.ok) setEditing(false)
              return r
            }, 'Budget saved.')}>Save</Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Set budget</Button>
        )}
        <div className="ml-auto flex gap-1">
          {active
            ? <Button size="sm" variant="ghost" onClick={() => run(() => updateProject({ id: p.id, status: 'paused' }), 'Paused.')}>Pause</Button>
            : <Button size="sm" variant="ghost" onClick={() => run(() => updateProject({ id: p.id, status: 'active' }), 'Activated.')}>Activate</Button>}
          {p.status !== 'done' && <Button size="sm" variant="ghost" onClick={() => run(() => updateProject({ id: p.id, status: 'done' }), 'Marked done.')}>Done</Button>}
        </div>
      </div>
    </div>
  )
}
