'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { archiveHabit, createHabit, toggleHabit } from '@/app/actions/training'
import { useTaskMutation } from '@/components/tasks/task-actions'
import type { HabitView } from '@/lib/data/training'
import type { HabitCell } from '@/domain/training/habits'

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const CELL: Record<HabitCell, string> = {
  done: 'bg-primary',
  miss: 'border border-muted-foreground/40',
  second_miss: 'bg-warning',
  off: 'bg-muted/50',
  pending: 'border border-dashed border-primary/60',
  none: 'bg-transparent',
}
const CELL_LABEL: Record<HabitCell, string> = {
  done: 'done', miss: 'missed', second_miss: 'missed twice', off: 'not scheduled', pending: 'today', none: '',
}

/** 30-day dot grid; consistency %, never miss twice — no streak headline (DESIGN §13.10). */
export function HabitList({ habits, today }: { habits: HabitView[]; today: string }) {
  const { pending, run } = useTaskMutation()
  const [name, setName] = useState('')
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const active = habits.filter((h) => h.active)
  const archived = habits.filter((h) => !h.active)

  return (
    <div className="space-y-6">
      {active.length === 0 && (
        <div className="rounded-2xl bg-leaf-soft px-4 py-6 text-center">
          <p className="text-3xl" aria-hidden>🌱</p>
          <p className="font-extrabold">No habits yet.</p>
          <p className="text-sm text-muted-foreground">Start with one small thing you’d like to do most days — like 10 minutes of reading.</p>
        </div>
      )}
      <ul className={`divide-y rounded-2xl bg-card shadow-soft ${pending ? 'opacity-70' : ''}`}>
        {active.map((h) => (
          <li key={h.id} className="space-y-2 px-4 py-3">
            <div className="flex items-center gap-3">
              {h.dueToday || h.doneToday ? (
                <Checkbox aria-label={`${h.name} done today`} checked={h.doneToday}
                  onCheckedChange={(c) => run(() => toggleHabit(h.id, today, !!c), c ? 'Logged.' : undefined)} />
              ) : <span className="size-4" />}
              <span className="flex-1 font-medium">{h.name}</span>
              <span className="text-sm tabular text-muted-foreground" title="Done on scheduled days, last 30 days">
                {h.grid.consistency === null ? '—' : `${h.grid.consistency}%`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 pl-7" aria-label={`${h.name}, last 30 days`}>
              {h.grid.days.map((c) => (
                <span key={c.day} title={`${c.day}${CELL_LABEL[c.state] ? ` · ${CELL_LABEL[c.state]}` : ''}`}
                  className={`size-3 rounded-full ${CELL[c.state]}`} />
              ))}
            </div>
            {h.grid.missedYesterday && !h.doneToday && h.dueToday && (
              <p className="pl-7 text-xs text-muted-foreground">Missed once — that’s fine. Today is the one that matters.</p>
            )}
            <div className="flex gap-3 pl-7 text-xs text-muted-foreground">
              <span>{h.weekdays.length === 7 ? 'Every day' : h.weekdays.map((d) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]).join(' ')}</span>
              <button className="hover:text-foreground" onClick={() => run(() => archiveHabit(h.id, false), 'Archived.')}>Archive</button>
            </div>
          </li>
        ))}
      </ul>

      <form className="space-y-2 rounded-2xl bg-card shadow-soft p-4"
        onSubmit={(e) => {
          e.preventDefault()
          run(async () => {
            const r = await createHabit(name, days)
            if (r.ok) setName('')
            return r
          }, 'Habit added.')
        }}>
        <label className="text-sm font-medium" htmlFor="habit-name">New habit</label>
        <div className="flex gap-2">
          <Input id="habit-name" value={name} maxLength={80} placeholder="e.g. 10 min reading" onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={pending || !name.trim() || !days.length}><Plus className="size-4" /> Add</Button>
        </div>
        <div className="flex gap-1" role="group" aria-label="Days">
          {DOW.map((d, i) => (
            <button key={i} type="button" aria-pressed={days.includes(i)} aria-label={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]}
              onClick={() => setDays((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i]))}
              className={`size-8 rounded-full text-xs ${days.includes(i) ? 'border border-primary bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{d}</button>
          ))}
        </div>
      </form>

      {archived.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Archived ({archived.length})</summary>
          <ul className="mt-2 space-y-1">
            {archived.map((h) => (
              <li key={h.id} className="flex justify-between px-1">
                <span className="text-muted-foreground">{h.name}</span>
                <button className="text-xs text-primary hover:underline" onClick={() => run(() => archiveHabit(h.id, true), 'Restored.')}>Restore</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
