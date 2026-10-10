import Link from 'next/link'
import { getViewer } from '@/lib/data/viewer'
import { loadToday, loadMultiplierSamples, toTaskView, TASK_SELECT } from '@/lib/data/today'
import { loadSkills } from '@/lib/data/skills'
import { loadCurrentDrill } from '@/lib/data/training'
import { FocusMode, type FocusTask, type RunningSession } from '@/components/focus/focus-mode'

export default async function FocusPage({ searchParams }: {
  searchParams: Promise<{ task?: string; block?: string; autostart?: string; mode?: string; minutes?: string; goal?: string; run?: string; finish?: string }>
}) {
  const sp = await searchParams
  const taskParam = sp.task
  const v = await getViewer()
  const [t, s, drill] = await Promise.all([loadToday(), loadSkills(), loadCurrentDrill()])

  let running: RunningSession | null = null
  // "Run my Today list": the Today list in order (leftovers excluded), one task after another.
  const queue = [...t.main, ...t.evening].filter((x) => !x.leftover)
  let taskId = taskParam ?? (sp.run === '1' ? queue[0]?.id ?? null : null)
  if (t.openSession) {
    const { data: sess } = await v.supabase.from('sessions')
      .select('id, mode, started_at, paused_at, paused_seconds, planned_minutes, goal_text, predicted_minutes, task_id').eq('id', t.openSession.id).single()
    const { count } = await v.supabase.from('distractions').select('id', { count: 'exact', head: true }).eq('session_id', t.openSession.id)
    if (sess) {
      taskId = sess.task_id
      running = {
        id: sess.id, mode: sess.mode as RunningSession['mode'], startedAt: sess.started_at, pausedAt: sess.paused_at,
        pausedSeconds: sess.paused_seconds, plannedMinutes: sess.planned_minutes, goal: sess.goal_text,
        predicted: sess.predicted_minutes, distractions: count ?? 0,
      }
    }
  }

  let task: FocusTask | null = null
  if (taskId) {
    const { data: raw } = await v.supabase.from('tasks').select(TASK_SELECT).eq('id', taskId).maybeSingle()
    if (raw) {
      const samples = await loadMultiplierSamples()
      const tv = toTaskView(raw as never, { rung: v.ladder.current_rung, samples, actual: 0, today: v.today, now: v.now, underServed: new Set(), drill })
      const starterNow = sp.mode === 'starter' && sp.autostart !== '1'
      task = {
        id: tv.id, title: tv.title, firstAction: tv.firstAction, reentryNote: tv.reentryNote, estimate: tv.estimate,
        suggestedMode: starterNow ? 'starter' : tv.mode, why: starterNow ? 'Starter now — just 5 minutes, then decide.' : tv.why,
      }
    }
  }

  if (!task) {
    const options = [...t.main, ...t.evening]
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
        <h1 className="text-2xl font-extrabold">What will you focus on?</h1>
        {options.length === 0 ? (
          <p className="text-white/60">Nothing on Today. <Link className="underline" href="/plan">Plan your day</Link> first.</p>
        ) : (
          <ul className="space-y-2">
            {options.map((o) => (
              <li key={o.id}>
                <Link href={`/focus?task=${o.id}`} className="block rounded-xl border border-white/10 px-4 py-3 hover:bg-white/5">{o.firstAction || o.title}</Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/" className="text-sm text-white/50 hover:text-white">← Home</Link>
      </main>
    )
  }

  return (
    <FocusMode
      key={task.id /* a new task (e.g. the next one in a run) starts a fresh session screen */}
      task={task}
      running={running}
      rung={v.ladder.current_rung}
      cleanCount={v.ladder.clean_count}
      suggestDown={v.ladder.suggest_down}
      timerLevel={s.levels.timer_mode}
      goalLevel={s.levels.session_goal}
      tone={v.tone}
      sound={v.settings.sound_enabled}
      goalRequired={drill === 'S6'}
      finishNow={!!running && sp.finish === '1'}
      run={sp.run === '1' && queue.some((q) => q.id === task.id) ? (() => {
        const i = queue.findIndex((q) => q.id === task!.id)
        const next = queue[i + 1]
        return { position: i + 1, total: queue.length, next: next ? { id: next.id, title: next.firstAction || next.title } : null }
      })() : null}
      autostart={!running && sp.autostart === '1' && sp.block ? {
        blockId: sp.block,
        mode: (['ladder', 'blind', 'starter', 'timebox', 'free'].includes(sp.mode ?? '') ? sp.mode : 'timebox') as FocusTask['suggestedMode'],
        plannedMinutes: Math.min(600, Math.max(5, Number(sp.minutes) || 25)),
        goal: sp.goal?.slice(0, 200) || null,
      } : null}
    />
  )
}
