import { AppShell } from '@/components/shell/app-shell'
import { getViewer } from '@/lib/data/viewer'
import { loadToday } from '@/lib/data/today'
import { loadGoals } from '@/lib/data/goals'
import type { WhatsLeftData } from '@/components/shell/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const v = await getViewer()
  const [t, goals, snap] = await Promise.all([loadToday(), loadGoals(), v.supabase.rpc('friends_snapshot')])
  const friends = ((snap.data ?? []) as { user_id: string; username: string; display_name: string | null }[])
    .map((f) => ({ id: f.user_id, name: f.display_name || `@${f.username}` }))

  const whatsLeft: WhatsLeftData = {
    dayPlanned: t.dayPlanned,
    dayClosed: t.dayClosed,
    remaining: [...t.main, ...t.evening].map((x) => ({ id: x.id, title: x.title, evening: x.status === 'evening', plannedMinutes: x.plannedMinutes })),
    doneCount: t.done.length,
    focusMinutes: t.focusMinutes,
    fit: { adjustedMinutes: t.fit.adjustedMinutes, availableMinutes: t.fit.availableMinutes, state: t.fit.state },
    inboxCount: t.inboxCount,
    hoursLeft: t.hoursLeft,
    budgets: t.budgets
      .filter((b) => b.status === 'active' && b.weekly_budget_minutes > 0)
      .map((b) => ({ id: b.id, name: b.name, color: b.color, actualMinutes: b.actualMinutes, budgetMinutes: b.weekly_budget_minutes, underServed: !!b.drift?.underServed })),
    goals: goals.filter((g) => g.status === 'active' && g.weeklyMinutes > 0)
      .map((g) => ({ id: g.id, title: g.title, spentMinutes: g.weekSpentMinutes, weeklyMinutes: g.weeklyMinutes, plannedMinutes: g.weekPlannedMinutes })),
  }

  return (
    <AppShell username={v.profile.username} whatsLeft={whatsLeft} openSession={t.openSession} userId={v.userId}
      friends={friends} workMode={v.settings.work_mode as 'solo' | 'pair'}>
      {children}
    </AppShell>
  )
}
