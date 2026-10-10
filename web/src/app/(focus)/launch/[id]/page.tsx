import { notFound } from 'next/navigation'
import { getViewer } from '@/lib/data/viewer'
import { loadGoals } from '@/lib/data/goals'
import { localDayMinute } from '@/domain/time/day'
import { LaunchScreen } from '@/components/focus/launch-screen'

export default async function LaunchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const v = await getViewer()
  const { data: b } = await v.supabase.from('calendar_blocks')
    .select('id, title, type, start_at, end_at, task_id, goal_id, timer_mode, if_then_text, status, tasks(title, first_action, reentry_note)')
    .eq('id', id).maybeSingle()
  if (!b || b.type === 'fixed' || b.status === 'cancelled') notFound()
  const goal = b.goal_id ? (await loadGoals()).find((g) => g.id === b.goal_id) : null
  const start = localDayMinute(new Date(b.start_at), v.profile.timezone)
  const minutes = Math.round((new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60_000)
  const checklist = Array.isArray(v.settings.setup_checklist) ? (v.settings.setup_checklist as string[]) : []

  return (
    <LaunchScreen
      block={{
        id: b.id, title: b.title, type: b.type, minutes, status: b.status, startIso: b.start_at,
        time: `${String(Math.floor(start.minute / 60)).padStart(2, '0')}:${String(start.minute % 60).padStart(2, '0')}`,
        ifThen: b.if_then_text, timerMode: b.timer_mode,
        firstAction: b.tasks?.first_action ?? null, reentry: b.tasks?.reentry_note ?? null,
        startsInMinutes: Math.round((new Date(b.start_at).getTime() - v.now.getTime()) / 60_000),
      }}
      serves={goal ? { title: goal.title, leftMinutes: Math.max(0, goal.weeklyMinutes - goal.weekSpentMinutes) } : null}
      checklist={checklist}
    />
  )
}
