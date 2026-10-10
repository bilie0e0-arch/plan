import { getViewer } from '@/lib/data/viewer'
import { loadMonth, loadWeek } from '@/lib/data/calendar'
import { loadGoals } from '@/lib/data/goals'
import { loadSkills } from '@/lib/data/skills'
import { addDays, dayRange, localDayMinute, localToUtc, weekStart } from '@/domain/time/day'
import { reflowToday } from '@/domain/calendar/reflow'
import { WeekPlanner } from '@/components/calendar/week-planner'
import { MonthView } from '@/components/calendar/month-view'

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string; move?: string; place?: string; from?: string; reflow?: string; view?: string; day?: string; month?: string }> }) {
  const sp = await searchParams
  const v = await getViewer()
  if (sp.view === 'month') {
    const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : v.today.slice(0, 7)
    return <MonthView month={month} today={v.today} days={await loadMonth(month)} />
  }
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : null
  const week = !sp.week && day ? weekStart(day) : sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? weekStart(sp.week) : weekStart(v.today)
  const [w, goals, skills, tasksRes, outcomesRes, projectsRes] = await Promise.all([
    loadWeek(week),
    loadGoals(),
    loadSkills(),
    v.supabase.from('tasks').select('id, title, first_action, estimate_minutes').in('status', ['today', 'evening', 'backlog']).order('sort_order').limit(30),
    v.supabase.from('block_outcomes').select('outcome, calendar_blocks(start_at)').order('assigned_at', { ascending: false }).limit(400),
    v.supabase.from('projects').select('id, name, color, weekly_budget_minutes').eq('status', 'active').order('created_at'),
  ])

  // Kept-rate by local hour → hint slots (only used while guidance is on; DESIGN §10.13).
  const byHour = new Map<number, { kept: number; total: number }>()
  for (const o of outcomesRes.data ?? []) {
    if (!o.calendar_blocks || o.outcome === 'released') continue
    const h = Math.floor(localDayMinute(new Date(o.calendar_blocks.start_at), v.profile.timezone).minute / 60)
    const cur = byHour.get(h) ?? { kept: 0, total: 0 }
    cur.total++
    if (o.outcome === 'kept') cur.kept++
    byHour.set(h, cur)
  }
  const strongHours = [...byHour.entries()].filter(([, x]) => x.total >= 3 && x.kept / x.total >= 0.7).map(([h]) => h)

  // A task sent here to be scheduled (aging queue) is preselected for placing.
  const tasks = (tasksRes.data ?? []).map((t) => ({ id: t.id, title: t.first_action || t.title, estimate: t.estimate_minutes }))
  const placeId = sp.place && /^[0-9a-f-]{36}$/.test(sp.place) ? sp.place : null
  if (placeId && !tasks.some((t) => t.id === placeId)) {
    const { data: t } = await v.supabase.from('tasks').select('id, title, first_action, estimate_minutes').eq('id', placeId).maybeSingle()
    if (t) tasks.unshift({ id: t.id, title: t.first_action || t.title, estimate: t.estimate_minutes })
  } else if (placeId) tasks.unshift(...tasks.splice(tasks.findIndex((t) => t.id === placeId), 1))

  // Re-flow today (rule-based preview): blocks that slipped by 10+ minutes, not started, not yet final.
  const today = dayRange(v.today, v.profile.timezone, v.profile.day_boundary_hour)
  const nowMs = v.now.getTime()
  const todays = w.blocks.filter((b) => new Date(b.start) >= today.start && new Date(b.start) < today.end)
  const missed = todays.filter((b) => !['fixed', 'buffer'].includes(b.type) && !b.outcome && !b.started && new Date(b.start).getTime() < nowMs - 10 * 60_000)
  const missedIds = new Set(missed.map((b) => b.id))
  const reflow = reflowToday({
    now: v.now,
    dayEnd: new Date(Math.min(today.end.getTime(), localToUtc(v.today, Math.min(24, v.settings.day_end_hour) * 60, v.profile.timezone).getTime())),
    missed: missed.map((b) => ({ id: b.id, title: b.title, start: new Date(b.start), end: new Date(b.end) })),
    busy: todays.filter((b) => !missedIds.has(b.id)).map((b) => ({ start: new Date(b.start), end: new Date(b.end) })),
  }).map((m) => ({ id: m.id, title: m.title, from: m.from.toISOString(), to: m.to ? m.to.toISOString() : null, minutes: m.minutes }))

  // Widen the grid so blocks outside the usual day window are still drawn.
  let startHour = v.settings.day_start_hour
  let endHour = v.settings.day_end_hour
  for (const b of w.blocks) {
    const s = localDayMinute(new Date(b.start), v.profile.timezone)
    const e = localDayMinute(new Date(b.end), v.profile.timezone)
    startHour = Math.min(startHour, Math.floor(s.minute / 60))
    endHour = Math.max(endHour, e.key === s.key ? Math.ceil(e.minute / 60) : 24)
  }

  return (
    <WeekPlanner
      week={week}
      today={v.today}
      days={Array.from({ length: 7 }, (_, i) => addDays(week, i))}
      timeZone={v.profile.timezone}
      dayStartHour={startHour}
      dayEndHour={Math.min(24, endHour)}
      blocks={w.blocks}
      freeMinutes={w.freeMinutes}
      plannedMinutes={w.plannedMinutes}
      weekCommitted={w.weekCommitted}
      goals={goals.filter((g) => g.status === 'active').map((g) => ({
        id: g.id, title: g.title, weeklyMinutes: g.weeklyMinutes, plannedMinutes: g.weekPlannedMinutes,
      }))}
      tasks={tasks}
      placeTaskId={placeId}
      fromReview={sp.from === 'review'}
      reflow={week === weekStart(v.today) ? reflow : []}
      reflowOpen={sp.reflow === '1'}
      projects={(projectsRes.data ?? []).map((p) => ({ id: p.id, name: p.name, color: p.color, weeklyMinutes: p.weekly_budget_minutes }))}
      strongHours={skills.levels.now_card === 'quiet' ? [] : strongHours}
      initialView={sp.view === 'day' || sp.view === 'week' ? sp.view : null}
      initialDay={day}
      moveId={sp.move ?? null}
      nowMs={v.now.getTime()}
    />
  )
}
