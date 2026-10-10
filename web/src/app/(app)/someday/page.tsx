import { loadList, loadProjectOptions } from '@/lib/data/lists'
import { ListRow } from '@/components/tasks/list-row'
import { HiddenSection } from '@/components/tasks/hidden-section'

export default async function SomedayPage() {
  const [someday, backlog, projects] = await Promise.all([loadList('someday', false), loadList('backlog', false), loadProjectOptions()])
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Maybe later 🌙</h1>
        <p className="text-sm text-muted-foreground">“Soon” has things you mean to do; “Someday” is parked without guilt.</p>
      </header>
      <Section title="Soon" empty="Nothing waiting.">{backlog.map((t) => <ListRow key={t.id} task={t} projects={projects} />)}</Section>
      <Section title="Someday" empty="Nothing parked.">{someday.map((t) => <ListRow key={t.id} task={t} projects={projects} />)}</Section>
      <HiddenSection status="backlog" />
      <HiddenSection status="someday" />
    </div>
  )
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="space-y-2">
      <h2 className="font-bold">{title} <span className="text-sm font-normal text-muted-foreground">{children.length}</span></h2>
      {children.length === 0
        ? <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
        : <ul className="divide-y rounded-2xl bg-card shadow-soft">{children}</ul>}
    </section>
  )
}
