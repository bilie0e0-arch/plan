import { getViewer } from '@/lib/data/viewer'
import { loadHabits } from '@/lib/data/training'
import { HabitList } from '@/components/training/habit-list'

export default async function HabitsPage() {
  const [v, habits] = await Promise.all([getViewer(), loadHabits()])
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Habits 🌿</h1>
        <p className="text-sm text-muted-foreground">Small things, most days. Missing once is normal — just don’t miss twice.</p>
      </header>
      <HabitList habits={habits} today={v.today} />
    </div>
  )
}
