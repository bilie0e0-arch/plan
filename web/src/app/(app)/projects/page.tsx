import { getViewer } from '@/lib/data/viewer'
import { loadMultiplierSamples, loadWeekBudgets } from '@/lib/data/today'
import { personalMultiplier } from '@/domain/plan/time-honesty'
import { NewProjectForm, ProjectCardView, type ProjectCard } from '@/components/projects/project-board'

export default async function ProjectsPage() {
  const { supabase, settings } = await getViewer()
  const [budgets, samples, openRes] = await Promise.all([
    loadWeekBudgets(),
    loadMultiplierSamples(),
    supabase.from('tasks').select('project_id').not('status', 'in', '(done,killed)').not('project_id', 'is', null),
  ])
  const open = new Map<string, number>()
  for (const t of openRes.data ?? []) if (t.project_id) open.set(t.project_id, (open.get(t.project_id) ?? 0) + 1)

  const cards: ProjectCard[] = budgets.map((b) => {
    const m = personalMultiplier(samples, b.id, null)
    return {
      id: b.id, name: b.name, color: b.color, status: b.status,
      budgetMinutes: b.weekly_budget_minutes, actualMinutes: b.actualMinutes,
      pace: b.drift?.pace ?? null, underServed: !!b.drift?.underServed,
      openTasks: open.get(b.id) ?? 0, multiplier: m.basis === 'project' ? m.value : null,
    }
  })
  const active = cards.filter((c) => c.status === 'active')
  const rest = cards.filter((c) => c.status !== 'active')

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Projects 📁</h1>
          <p className="text-sm text-muted-foreground">The big areas of your life, and how much time each gets this week. Add <code>#name</code> to a task to file it.</p>
        </div>
        <span className="text-sm text-muted-foreground tabular">{active.length} / {settings.active_project_cap} active</span>
      </header>
      <NewProjectForm />
      {cards.length === 0 && <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No projects yet. Add your first life area above.</p>}
      <div className="grid gap-3 sm:grid-cols-2">{active.map((p) => <ProjectCardView key={p.id} p={p} />)}</div>
      {rest.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Paused & done</h2>
          <div className="grid gap-3 sm:grid-cols-2">{rest.map((p) => <ProjectCardView key={p.id} p={p} />)}</div>
        </section>
      )}
    </div>
  )
}
