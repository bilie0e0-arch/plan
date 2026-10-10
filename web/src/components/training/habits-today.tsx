'use client'

import Link from 'next/link'
import { Checkbox } from '@/components/ui/checkbox'
import { toggleHabit } from '@/app/actions/training'
import { useTaskMutation } from '@/components/tasks/task-actions'

export function HabitsToday({ habits, today }: { habits: { id: string; name: string; done: boolean; missedYesterday: boolean }[]; today: string }) {
  const { pending, run } = useTaskMutation()
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold">Habits</h2>
        <Link href="/habits" className="text-xs text-muted-foreground hover:text-foreground">All habits</Link>
      </div>
      <ul className={`flex flex-wrap gap-2 ${pending ? 'opacity-60' : ''}`}>
        {habits.map((h) => (
          <li key={h.id}>
            <label className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${h.done ? 'bg-accent text-accent-foreground' : 'bg-card'}`}
              title={h.missedYesterday && !h.done ? 'Missed yesterday — don’t miss twice' : undefined}>
              <Checkbox checked={h.done} aria-label={`${h.name} done today`} onCheckedChange={(c) => run(() => toggleHabit(h.id, today, !!c))} />
              {h.name}
              {h.missedYesterday && !h.done && <span className="size-1.5 rounded-full bg-warning" />}
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
