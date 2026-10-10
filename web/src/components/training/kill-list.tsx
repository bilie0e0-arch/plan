'use client'

import { restoreTask } from '@/app/actions/training'
import { useTaskMutation } from '@/components/tasks/task-actions'
import { ProjectDot } from '@/components/tasks/task-chips'

/** Dropped tasks, framed as decisions made (DESIGN F21). */
export function KillList({ tasks }: { tasks: { id: string; title: string; killedAt: string | null; projectName: string | null; projectColor: string | null }[] }) {
  const { pending, run } = useTaskMutation()
  if (!tasks.length) return <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Nothing let go yet. Saying no is a skill too.</p>
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{tasks.length} thing{tasks.length === 1 ? '' : 's'} let go — attention you got back.</p>
      <ul className={`divide-y rounded-2xl bg-card shadow-soft ${pending ? 'opacity-60' : ''}`}>
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
            <ProjectDot color={t.projectColor} name={t.projectName} />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{t.title}</span>
            {t.killedAt && <span className="text-xs text-muted-foreground tabular">{new Date(t.killedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
            <button className="text-xs text-primary hover:underline" disabled={pending} onClick={() => run(() => restoreTask(t.id), 'Restored to backlog.')}>Restore</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
