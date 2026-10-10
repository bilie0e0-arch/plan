'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { setGoalStatus, setWeeklyCommitment, toggleMilestone, updateGoalProgress } from '@/app/actions/goals'
import { useTaskMutation } from '@/components/tasks/task-actions'

export function GoalControls({ goal }: {
  goal: { id: string; status: string; type: string; currentValue: number; targetValue: number | null; unit: string | null; weeklyHours: number
    milestones: { id: string; title: string; dueDate: string | null; done: boolean }[] }
}) {
  const { pending, run } = useTaskMutation()
  const [value, setValue] = useState(String(goal.currentValue))
  const [hours, setHours] = useState(String(goal.weeklyHours))
  return (
    <section className={`space-y-4 rounded-2xl bg-card shadow-soft p-5 ${pending ? 'opacity-70' : ''}`}>
      {goal.milestones.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Milestones</h2>
          {goal.milestones.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={m.done} onCheckedChange={(c) => run(() => toggleMilestone(m.id, !!c), c ? 'Milestone reached.' : undefined)} />
              <span className={m.done ? 'text-muted-foreground line-through' : ''}>{m.title}</span>
              {m.dueDate && <span className="ml-auto text-xs text-muted-foreground">{m.dueDate}</span>}
            </label>
          ))}
        </div>
      )}
      {goal.type !== 'process' && goal.targetValue !== null && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Current progress ({goal.unit ?? 'units'} of {goal.targetValue})</span>
            <Input className="w-32" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ''))} />
          </label>
          <Button variant="outline" onClick={() => run(() => updateGoalProgress(goal.id, Number(value) || 0), 'Progress saved.')}>Update</Button>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Weekly promise (hours)</span>
          <Input className="w-24" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value.replace(/[^\d.]/g, ''))} />
        </label>
        <Button variant="outline" onClick={() => run(() => setWeeklyCommitment(goal.id, Number(hours) || 0), 'Saved. Applies from your next committed week.')}>Save</Button>
      </div>
      <div className="flex flex-wrap gap-2 border-t pt-4">
        {goal.status !== 'active' && <Button onClick={() => run(() => setGoalStatus(goal.id, 'active'), 'Activated.')}>Activate</Button>}
        {goal.status === 'active' && <Button variant="outline" onClick={() => run(() => setGoalStatus(goal.id, 'paused'), 'Paused.')}>Pause</Button>}
        {goal.status !== 'done' && <Button variant="outline" onClick={() => run(() => setGoalStatus(goal.id, 'done'), 'Goal done. Well earned.')}>Mark achieved</Button>}
        <Button variant="ghost" onClick={() => run(() => setGoalStatus(goal.id, 'dropped'), 'Dropped — a decision, not a failure.')}>Drop</Button>
      </div>
    </section>
  )
}
