import { getViewer } from '@/lib/data/viewer'
import { loadToday } from '@/lib/data/today'
import { ShutdownFlow } from '@/components/day/shutdown-flow'
import { reflectionQuestion } from '@/domain/training/week'

export default async function ShutdownPage() {
  const v = await getViewer()
  const t = await loadToday()

  // Done Wall data: focus minutes per project + rung climbs today
  const perProject = new Map<string, { name: string; color: string; minutes: number }>()
  for (const s of t.sessions) {
    const p = s.tasks?.projects
    const key = p?.name ?? 'No project'
    const cur = perProject.get(key) ?? { name: key, color: p?.color ?? 'stone', minutes: 0 }
    cur.minutes += Math.round((s.active_seconds ?? 0) / 60)
    perProject.set(key, cur)
  }
  const ladderSessions = t.sessions.filter((s) => s.mode === 'ladder' && s.is_clean)
  const climbedTo = v.ladder.updated_at >= (t.sessions[0]?.started_at ?? 'z') ? v.ladder.current_rung : null
  const firstRung = t.sessions.find((s) => s.mode === 'ladder')?.ladder_rung ?? null

  return (
    <ShutdownFlow
      tone={v.tone}
      closed={t.dayClosed}
      leftovers={[...t.main, ...t.evening].map((x) => ({ id: x.id, title: x.firstAction || x.title }))}
      done={t.done.map((d) => ({ id: d.id, title: d.title, color: d.projects?.color ?? null }))}
      focusMinutes={t.focusMinutes}
      sessions={t.sessions.filter((s) => s.outcome !== 'abandoned').length}
      cleanLadder={ladderSessions.length}
      rungClimb={climbedTo && firstRung && climbedTo > firstRung ? climbedTo : null}
      reflection={{ question: t.plan?.reflection_question ?? reflectionQuestion(v.today), text: t.plan?.reflection_text ?? '' }}
      projects={[...perProject.values()].filter((p) => p.minutes > 0).sort((a, b) => b.minutes - a.minutes)}
    />
  )
}
