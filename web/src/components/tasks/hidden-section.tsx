import { loadList, loadProjectOptions } from '@/lib/data/lists'
import { ListRow } from './list-row'

/** Tasks hidden until a later day: out of the way, but one tap from coming back ("Show now" in the menu). */
export async function HiddenSection({ status }: { status: 'inbox' | 'someday' | 'backlog' }) {
  const [tasks, projects] = await Promise.all([loadList(status, true, true), loadProjectOptions()])
  if (!tasks.length) return null
  return (
    <details className="group text-sm">
      <summary className="cursor-pointer list-none text-muted-foreground hover:text-foreground">
        {tasks.length} hidden until later <span className="group-open:hidden">· show</span>
      </summary>
      <ul className="mt-2 divide-y rounded-2xl bg-card/70 shadow-soft">
        {tasks.map((t) => <ListRow key={t.id} task={t} projects={projects} />)}
      </ul>
    </details>
  )
}
