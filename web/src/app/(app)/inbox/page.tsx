import Link from 'next/link'
import { loadList, loadProjectOptions } from '@/lib/data/lists'
import { ListRow } from '@/components/tasks/list-row'
import { ProcessInbox } from '@/components/tasks/process-inbox'
import { Button } from '@/components/ui/button'
import { HiddenSection } from '@/components/tasks/hidden-section'

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ process?: string }> }) {
  const { process } = await searchParams
  const [tasks, projects] = await Promise.all([loadList('inbox'), loadProjectOptions()])

  if (process) {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight">Sort your ideas 💡</h1>
          <Link href="/inbox" className="text-sm text-muted-foreground hover:text-foreground">List view</Link>
        </header>
        <ProcessInbox tasks={tasks} projects={projects} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Ideas 💡</h1>
          <p className="text-sm text-muted-foreground">Things you noted for later. Tap ☀️ to do one today — or press <kbd className="rounded border px-1 font-mono">Q</kbd> to add.</p>
        </div>
        {tasks.length > 0 && <Link href="/inbox?process=1"><Button>Sort one by one</Button></Link>}
      </header>
      {tasks.length === 0 ? (
        <div className="rounded-2xl bg-card px-4 py-8 text-center shadow-soft"><p className="text-3xl" aria-hidden>🌱</p><p className="font-extrabold">No ideas waiting.</p><p className="text-sm text-muted-foreground">When something pops into your head, press Q and it lands here.</p></div>
      ) : (
        <ul data-testid="inbox-list" className="divide-y rounded-2xl bg-card shadow-soft">
          {tasks.map((t) => <ListRow key={t.id} task={t} projects={projects} />)}
        </ul>
      )}
      <HiddenSection status="inbox" />
    </div>
  )
}
