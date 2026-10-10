import Link from 'next/link'
import { getViewer } from '@/lib/data/viewer'
import { loadAging, loadKilled } from '@/lib/data/training'
import { AgingQueue } from '@/components/training/aging-queue'
import { KillList } from '@/components/training/kill-list'

export default async function AgingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = 'queue' } = await searchParams
  const v = await getViewer()
  const [aging, killed] = await Promise.all([loadAging(), tab === 'killed' ? loadKilled() : Promise.resolve([])])
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Decide 🧹</h1>
          <p className="text-sm text-muted-foreground">Tasks nobody touched for {v.settings.aging_days}+ days. Decide each one — keeping them around quietly costs energy.</p>
        </div>
        <div className="flex gap-1 rounded-lg border p-0.5 text-sm">
          <Link href="/aging" className={`rounded-md px-3 py-1 ${tab !== 'killed' ? 'bg-muted font-medium' : 'text-muted-foreground'}`}>Queue {aging.length > 0 && <span className="tabular">({aging.length})</span>}</Link>
          <Link href="/aging?tab=killed" className={`rounded-md px-3 py-1 ${tab === 'killed' ? 'bg-muted font-medium' : 'text-muted-foreground'}`}>Let go</Link>
        </div>
      </header>
      {tab === 'killed' ? <KillList tasks={killed} /> : <AgingQueue tasks={aging} />}
    </div>
  )
}
