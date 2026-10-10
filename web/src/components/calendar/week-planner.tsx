'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Lock, Play, Repeat, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chips, Choice } from '@/components/ui/choice'
import { Kbd } from '@/components/ui/kbd'
import { commitWeek, createBlock, updateBlock } from '@/app/actions/calendar'
import { useTaskMutation } from '@/components/tasks/task-actions'
import { addDays, dayOfWeek, localDayMinute, localToUtc } from '@/domain/time/day'
import { CAPACITY_RATIO } from '@/domain/calendar/blocks'
import { parseBlockText } from '@/domain/calendar/parse-block'
import { fmtMinutes } from '@/lib/format'
import type { BlockView } from '@/lib/data/calendar'
import { ReflowButton, type ReflowPreview } from './reflow-button'
import { EditBlockDialog, fmtDay, fmtTime } from './block-dialogs'

const SLOT = 30
const SNAP = 15
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export interface ProjectBudget { id: string; name: string; color: string; weeklyMinutes: number }
type Chip = { kind: 'goal' | 'task' | 'project'; id: string; title: string; minutes: number; goalId: string | null; taskId: string | null; projectId: string | null; color: string | null }
type Draft = { id: string; day: string; minute: number; dur: number }
type Positioned = BlockView & { day: string; minute: number; dur: number }

const tint = (color: string | null | undefined) => (color ? `var(--project-${color})` : 'var(--primary)')

/**
 * The calendar (DESIGN §9.3, UI v0.7): Day / Week views on one screen. Drag down on an empty time to block it,
 * drag a block to move it, drag its bottom edge to resize. Tray chips (hours left, tasks) are tapped then a
 * time is tapped, or dragged onto the grid. Quick add takes plain words: "Biology 4-6pm tomorrow".
 */
export function WeekPlanner(props: {
  week: string; today: string; days: string[]; timeZone: string; dayStartHour: number; dayEndHour: number
  blocks: BlockView[]; freeMinutes: number; plannedMinutes: number; weekCommitted: boolean
  goals: { id: string; title: string; weeklyMinutes: number; plannedMinutes: number }[]
  projects: ProjectBudget[]
  tasks: { id: string; title: string; estimate: number | null }[]
  strongHours: number[]; moveId: string | null; nowMs: number
  initialView: 'day' | 'week' | null; initialDay: string | null
  placeTaskId?: string | null; fromReview?: boolean
  reflow?: ReflowPreview[]; reflowOpen?: boolean
}) {
  const router = useRouter()
  const { pending, run } = useTaskMutation()
  const [view, setView] = useState<'day' | 'week'>(props.initialView ?? 'week')
  const [day, setDay] = useState(props.initialDay && props.days.includes(props.initialDay) ? props.initialDay : props.days.includes(props.today) ? props.today : props.days[0]!)
  const [placing, setPlacing] = useState<Chip | null>(() => {
    const t = props.placeTaskId ? props.tasks.find((x) => x.id === props.placeTaskId) : null
    return t ? taskChip(t) : null
  })
  const [moving, setMoving] = useState<string | null>(props.moveId)
  const [editing, setEditing] = useState<BlockView | null>(null)
  const [creating, setCreating] = useState<{ day: string; minute: number; dur: number; x: number; y: number } | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const quick = useRef<HTMLInputElement>(null)

  // Phones open on the Day view unless a view was asked for.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!props.initialView && window.matchMedia('(max-width: 767px)').matches) setView('day')
  }, [props.initialView])
  // Fresh server data replaces optimistic drafts.
  useEffect(() => { setDrafts({}) }, [props.blocks]) // eslint-disable-line react-hooks/set-state-in-effect

  const startMin = props.dayStartHour * 60
  const endMin = props.dayEndHour * 60
  const shownDays = view === 'day' ? [day] : props.days

  const positioned: Positioned[] = useMemo(() => props.blocks.map((b) => {
    const d = drafts[b.id]
    if (d) return { ...b, day: d.day, minute: d.minute, dur: d.dur }
    const s = localDayMinute(new Date(b.start), props.timeZone)
    return { ...b, day: s.key, minute: s.minute, dur: Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000) }
  }), [props.blocks, props.timeZone, drafts])

  // Hours per subject this week, against each project's weekly budget.
  const subjectMinutes = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of positioned) if (b.subject && b.type !== 'fixed') m.set(b.subject.id, (m.get(b.subject.id) ?? 0) + b.dur)
    return m
  }, [positioned])
  const budgets = props.projects.filter((p) => p.weeklyMinutes > 0)
  const capacity = props.freeMinutes ? props.plannedMinutes / props.freeMinutes : 0
  const hasUncommitted = props.blocks.some((b) => b.status === 'planned' && !['fixed', 'buffer'].includes(b.type) && new Date(b.start).getTime() > props.nowMs)

  // ───── navigation ─────
  const go = (v: 'day' | 'week' | 'month', d = day) => {
    if (v === 'month') return router.push(`/calendar?view=month&month=${d.slice(0, 7)}`)
    setView(v)
    window.history.replaceState(null, '', `/calendar?view=${v}&week=${props.week}&day=${d}`)
  }
  const shift = (dir: 1 | -1) => {
    if (view === 'week') return router.push(`/calendar?view=week&week=${addDays(props.week, dir * 7)}`)
    const next = addDays(day, dir)
    if (props.days.includes(next)) { setDay(next); window.history.replaceState(null, '', `/calendar?view=day&week=${props.week}&day=${next}`) }
    else router.push(`/calendar?view=day&week=${addDays(props.week, dir * 7)}&day=${next}`)
  }
  const goToday = () => {
    if (props.days.includes(props.today)) { setDay(props.today); window.history.replaceState(null, '', `/calendar?view=${view}&day=${props.today}`) }
    else router.push(`/calendar?view=${view}`)
  }

  // ───── placing ─────
  function placeAt(d: string, minute: number, chip: Chip | null = placing) {
    const start = localToUtc(d, minute, props.timeZone)
    if (moving) {
      const b = positioned.find((x) => x.id === moving)
      setMoving(null)
      if (b) move(b, d, minute, b.dur)
      router.replace(`/calendar?view=${view}&week=${props.week}`)
      return
    }
    if (!chip) return
    setPlacing(null)
    run(() => createBlock({
      type: 'focus', title: chip.title, start: start.toISOString(), minutes: chip.minutes,
      taskId: chip.taskId, goalId: chip.goalId, projectId: chip.projectId, timerMode: null, commit: props.weekCommitted, repeatWeekdays: [],
    }), 'Block placed.')
  }
  function move(b: Positioned, d: string, minute: number, dur: number) {
    setDrafts((x) => ({ ...x, [b.id]: { id: b.id, day: d, minute, dur } }))
    run(async () => {
      const r = await updateBlock({ id: b.id, start: localToUtc(d, minute, props.timeZone).toISOString(), minutes: dur })
      if (!r.ok) setDrafts((x) => { const n = { ...x }; delete n[b.id]; return n })
      return r
    }, dur !== b.dur && minute === b.minute && d === b.day ? 'Resized.' : 'Moved.')
  }

  // ───── quick add ─────
  const [qa, setQa] = useState('')
  const parsed = qa.trim() ? parseBlockText(qa, props.today, props.projects.map((p) => p.name)) : null
  const quickAdd = () => {
    if (!parsed || parsed.start === null || !parsed.title) return
    const proj = props.projects.find((p) => p.name.toLowerCase() === parsed.projectName?.toLowerCase())
    run(async () => {
      const r = await createBlock({
        type: 'focus', title: parsed.title, start: localToUtc(parsed.day, parsed.start!, props.timeZone).toISOString(), minutes: parsed.minutes,
        taskId: null, goalId: null, projectId: proj?.id ?? null, timerMode: null, commit: props.weekCommitted, repeatWeekdays: [],
      })
      if (r.ok) {
        setQa('')
        if (!props.days.includes(parsed.day)) router.push(`/calendar?view=${view}&week=${addDays(parsed.day, -dayOfWeek(parsed.day))}&day=${parsed.day}`)
      }
      return r
    }, 'Added ✓')
  }

  // ───── keys: D / W / M views, T today, ← →, N or / to type, Esc cancels ─────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target instanceof HTMLElement ? e.target : null
      if (e.ctrlKey || e.metaKey || e.altKey || (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)))) return
      if (editing || creating || document.querySelector('[role="dialog"]')) return
      const k = e.key.toLowerCase()
      if (k === 'd') go('day')
      else if (k === 'w') go('week')
      else if (k === 'm') go('month')
      else if (k === 't') goToday()
      else if (e.key === 'ArrowLeft') shift(-1)
      else if (e.key === 'ArrowRight') shift(1)
      else if (k === 'n' || k === '/') { e.preventDefault(); quick.current?.focus() }
      else if (e.key === 'Escape') { setPlacing(null); setMoving(null) }
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const rangeLabel = view === 'day'
    ? new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(keyDate(day))
    : `${fmtDay(props.days[0]!)} – ${fmtDay(props.days[6]!)}`
  const movingBlock = moving ? positioned.find((b) => b.id === moving) : null

  return (
    <div className={`flex flex-col gap-3 md:h-[calc(100dvh-8.5rem)] ${pending ? 'cursor-progress' : ''}`}>
      <header className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-2xl font-black tracking-tight">Plan</h1>
        <div className="flex rounded-xl bg-muted p-1" role="tablist" aria-label="Calendar view">
          {(['day', 'week', 'month'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => go(v)}
              className={`rounded-lg px-3 py-1.5 text-sm font-extrabold capitalize ${view === v ? 'bg-card shadow-soft' : 'text-muted-foreground'}`}>
              {v}<Kbd>{v[0]!.toUpperCase()}</Kbd>
            </button>
          ))}
        </div>
        <div className="flex items-center text-sm font-bold">
          <button onClick={() => shift(-1)} aria-label={view === 'day' ? 'Previous day' : 'Previous week'} className="rounded-lg p-1.5 hover:bg-muted"><ChevronLeft className="size-4" /></button>
          <button onClick={goToday} className="rounded-lg px-2 py-1 hover:bg-muted">Today<Kbd>T</Kbd></button>
          <button onClick={() => shift(1)} aria-label={view === 'day' ? 'Next day' : 'Next week'} className="rounded-lg p-1.5 hover:bg-muted"><ChevronRight className="size-4" /></button>
          <span className="ml-1 text-muted-foreground">{rangeLabel}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ReflowButton moves={props.reflow ?? []} timeZone={props.timeZone} autoOpen={!!props.reflowOpen} />
          {hasUncommitted && (
            <Button disabled={pending} onClick={() => run(() => commitWeek(props.week), 'Week locked in 🔒 Your original plan is saved so you can compare later.')}>
              <Lock className="size-4" /> Lock in my week
            </Button>
          )}
          {!hasUncommitted && props.weekCommitted && <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">Week locked in ✓</span>}
        </div>
      </header>

      {/* Hours per subject + capacity */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        {budgets.map((p) => {
          const mins = subjectMinutes.get(p.id) ?? 0
          return (
            <div key={p.id} className="flex shrink-0 items-center gap-2 rounded-xl bg-card px-2.5 py-1.5 text-xs font-extrabold shadow-soft">
              <span className="size-2.5 rounded-full" style={{ background: tint(p.color) }} />{p.name}
              <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, (mins / p.weeklyMinutes) * 100)}%`, background: tint(p.color) }} /></span>
              <span className="tabular text-muted-foreground">{fmtMinutes(mins)} / {fmtMinutes(p.weeklyMinutes)}</span>
            </div>
          )
        })}
        <span className={`ml-auto hidden shrink-0 text-xs font-bold md:inline ${capacity > CAPACITY_RATIO ? 'text-warning-foreground' : 'text-muted-foreground'}`}>
          Planned {fmtMinutes(props.plannedMinutes)} of {fmtMinutes(props.freeMinutes)} free · {Math.round(capacity * 100)}%{capacity <= CAPACITY_RATIO ? ' — room for real life ✓' : ` — over ${Math.round(CAPACITY_RATIO * 100)}%, leave some slack`}
        </span>
      </div>

      {props.fromReview && (
        <Link href="/review" className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-2 text-sm text-muted-foreground hover:bg-muted"><ChevronLeft className="size-4" /> Back to weekly review</Link>
      )}
      {(moving && movingBlock) || placing ? (
        <div className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground">
          {movingBlock ? <>Where will <b>{movingBlock.title}</b> go? Tap a free time.</> : <>Tap a time to place “{placing!.title}”.</>}
          <button className="ml-auto" aria-label="Cancel" onClick={() => { setMoving(null); setPlacing(null) }}><X className="size-4" /></button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        {/* Tray */}
        <aside className="flex shrink-0 flex-col gap-2 lg:w-56">
          <div>
            <input ref={quick} value={qa} onChange={(e) => setQa(e.target.value)} aria-label="Quick add a block" placeholder="Biology 4–6pm tomorrow"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); quickAdd() } else if (e.key === 'Escape') { setQa(''); e.currentTarget.blur() } }}
              className="h-11 w-full rounded-xl border-2 border-border bg-card px-3 text-sm font-bold outline-none focus:border-primary" />
            <p className="min-h-5 px-1 pt-1 text-xs text-muted-foreground">
              {!parsed ? <>Type it and press <b className="text-primary">Enter</b><Kbd>N</Kbd></>
                : parsed.start === null ? <>→ <b className="text-foreground">{parsed.title || '…'}</b> · add a time, e.g. “4pm”</>
                  : <>→ <b className="text-foreground">{parsed.title}</b> · {fmtDay(parsed.day)} {fmtTime(parsed.start)}–{fmtTime(parsed.start + parsed.minutes)}{parsed.projectName ? ` · ${parsed.projectName}` : ''}</>}
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-y-auto">
            {(props.goals.length > 0 || budgets.length > 0) && <h2 className="hidden px-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground lg:block">Hours left to place</h2>}
            {budgets.map((p) => {
              const left = Math.max(0, p.weeklyMinutes - (subjectMinutes.get(p.id) ?? 0))
              if (!left) return null
              const chip: Chip = { kind: 'project', id: `p:${p.id}`, title: p.name, minutes: Math.min(60, left), goalId: null, taskId: null, projectId: p.id, color: p.color }
              return <TrayChip key={chip.id} chip={chip} sub={`${fmtMinutes(left)} left`} active={placing?.id === chip.id} onPick={() => setPlacing(placing?.id === chip.id ? null : chip)} />
            })}
            {props.goals.map((g) => {
              const left = Math.max(0, g.weeklyMinutes - g.plannedMinutes)
              const chip: Chip = { kind: 'goal', id: g.id, title: g.title, minutes: Math.min(60, left || 60), goalId: g.id, taskId: null, projectId: null, color: null }
              return <TrayChip key={g.id} chip={chip} sub={left ? `${fmtMinutes(left)} left to place` : 'All hours placed'} active={placing?.id === g.id} onPick={() => setPlacing(placing?.id === g.id ? null : chip)} />
            })}
            {props.goals.length === 0 && budgets.length === 0 && <p className="px-1 text-xs text-muted-foreground"><Link href="/goals/new" className="text-primary hover:underline">Create a goal</Link> or give a project weekly hours to see them here.</p>}
            {props.tasks.length > 0 && <h2 className="hidden px-1 pt-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground lg:block">Tasks</h2>}
            {props.tasks.slice(0, 6).map((t) => {
              const chip = taskChip(t)
              return <TrayChip key={t.id} chip={chip} sub={fmtMinutes(chip.minutes)} active={placing?.id === t.id} onPick={() => setPlacing(placing?.id === t.id ? null : chip)} />
            })}
          </div>
        </aside>

        {/* Grid */}
        <Grid days={shownDays} today={props.today} timeZone={props.timeZone} startMin={startMin} endMin={endMin} nowMs={props.nowMs}
          blocks={positioned} strongHours={props.strongHours} placing={!!placing || !!moving} wide={view === 'day'}
          onPlace={placeAt} onDropChip={(d, m, chip) => placeAt(d, m, chip)}
          onCreate={(d, m, dur, x, y) => setCreating({ day: d, minute: m, dur, x, y })}
          onMove={move} onOpen={(b) => (b.type === 'fixed' ? null : setEditing(b))} />

        {view === 'day' && <DayPanel day={day} blocks={positioned.filter((b) => b.day === day)} nowMs={props.nowMs} timeZone={props.timeZone} />}
      </div>

      {creating && (
        <CreatePopover at={creating} projects={props.projects} goals={props.goals} tasks={props.tasks} commit={props.weekCommitted} timeZone={props.timeZone}
          onClose={() => setCreating(null)} />
      )}
      {editing && <EditBlockDialog block={editing} timeZone={props.timeZone} nowMs={props.nowMs} projects={props.projects} onClose={() => setEditing(null)} />}
    </div>
  )
}

function taskChip(t: { id: string; title: string; estimate: number | null }): Chip {
  return { kind: 'task', id: t.id, title: t.title, minutes: Math.max(15, Math.min(120, t.estimate ?? 30)), goalId: null, taskId: t.id, projectId: null, color: null }
}
function keyDate(key: string) {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d))
}

function TrayChip({ chip, sub, active, onPick }: { chip: Chip; sub: string; active: boolean; onPick: () => void }) {
  return (
    <button draggable onClick={onPick} onDragStart={(e) => e.dataTransfer.setData('application/x-plan', JSON.stringify({ chip }))}
      className={`flex w-44 shrink-0 cursor-grab items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-left text-sm shadow-soft transition-colors lg:w-full ${active ? 'border-primary bg-accent' : 'border-transparent bg-card hover:bg-muted'}`}>
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: chip.color ? tint(chip.color) : chip.kind === 'goal' ? 'var(--sky)' : 'var(--muted-foreground)' }} />
      <span className="min-w-0 flex-1"><span className="block truncate font-extrabold">{chip.title}</span><span className="block text-[11px] font-bold text-muted-foreground">{sub}</span></span>
    </button>
  )
}

// ───────────── grid ─────────────

function Grid({ days, today, timeZone, startMin, endMin, nowMs, blocks, strongHours, placing, wide, onPlace, onDropChip, onCreate, onMove, onOpen }: {
  days: string[]; today: string; timeZone: string; startMin: number; endMin: number; nowMs: number
  blocks: Positioned[]; strongHours: number[]; placing: boolean; wide: boolean
  onPlace: (day: string, minute: number) => void
  onDropChip: (day: string, minute: number, chip: Chip) => void
  onCreate: (day: string, minute: number, dur: number, x: number, y: number) => void
  onMove: (b: Positioned, day: string, minute: number, dur: number) => void
  onOpen: (b: BlockView) => void
}) {
  const body = useRef<HTMLDivElement>(null)
  const [h, setH] = useState(480)
  useLayoutEffect(() => {
    const el = body.current
    if (!el) return
    const ro = new ResizeObserver(() => setH(Math.max(360, el.clientHeight)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const ppm = h / (endMin - startMin)
  const y = (m: number) => (m - startMin) * ppm
  const [ghost, setGhost] = useState<{ day: string; a: number; b: number } | null>(null)
  const drag = useRef<null | { mode: 'new'; day: string; a: number; moved: boolean } | { mode: 'move' | 'resize'; b: Positioned; off: number; day: string; minute: number; dur: number; moved: boolean }>(null)
  const [live, setLive] = useState<Draft | null>(null)
  const [now, setNow] = useState(nowMs)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t) }, [])

  const minuteAt = (col: HTMLElement, clientY: number) => {
    const r = col.getBoundingClientRect()
    return Math.max(startMin, Math.min(endMin, startMin + Math.round((clientY - r.top) / ppm / SNAP) * SNAP))
  }
  const colAt = (x: number, yy: number) => document.elementsFromPoint(x, yy).find((e) => e instanceof HTMLElement && e.dataset.col) as HTMLElement | undefined
  const isPast = (d: string, m: number) => localToUtc(d, m, timeZone).getTime() < now - 5 * 60_000

  function onPointerDown(e: React.PointerEvent, d: string) {
    if (e.button !== 0 || placing) return
    const col = e.currentTarget as HTMLElement
    const m = minuteAt(col, e.clientY)
    const blockEl = (e.target as HTMLElement).closest<HTMLElement>('[data-block-id]')
    if (blockEl) {
      const b = blocks.find((x) => x.id === blockEl.dataset.blockId)
      if (!b) return
      const resize = (e.target as HTMLElement).dataset.resize === '1'
      drag.current = { mode: resize ? 'resize' : 'move', b, off: m - b.minute, day: b.day, minute: b.minute, dur: b.dur, moved: false }
    } else {
      if (isPast(d, m)) return
      drag.current = { mode: 'new', day: d, a: m, moved: false }
      setGhost({ day: d, a: m, b: m + 60 })
    }
    col.setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    const g = drag.current
    if (!g) return
    if (g.mode === 'new') {
      const col = (e.currentTarget as HTMLElement)
      const m = minuteAt(col, e.clientY)
      g.moved = g.moved || Math.abs(m - g.a) >= SNAP
      setGhost({ day: g.day, a: g.a, b: Math.max(g.a + SNAP, m) })
      return
    }
    const col = colAt(e.clientX, e.clientY)
    if (!col) return
    const m = minuteAt(col, e.clientY)
    const movable = g.b.type !== 'fixed' && !g.b.outcome
    if (!movable) return
    if (g.mode === 'move') {
      const minute = Math.max(startMin, Math.min(endMin - g.b.dur, m - g.off))
      const d = col.dataset.col!
      g.moved = g.moved || minute !== g.b.minute || d !== g.b.day
      g.day = d; g.minute = minute
      setLive({ id: g.b.id, day: d, minute, dur: g.b.dur })
    } else {
      const dur = Math.max(SNAP, Math.min(endMin - g.b.minute, m - g.b.minute))
      g.moved = g.moved || dur !== g.b.dur
      g.dur = dur
      setLive({ id: g.b.id, day: g.b.day, minute: g.b.minute, dur })
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    const g = drag.current
    drag.current = null
    if (!g) return
    if (g.mode === 'new') {
      setGhost(null)
      const a = g.a, b = g.moved ? Math.max(g.a + SNAP, minuteAt(e.currentTarget as HTMLElement, e.clientY)) : g.a + 60
      onCreate(g.day, a, Math.min(b, endMin) - a, e.clientX, e.clientY)
      return
    }
    setLive(null)
    if (!g.moved) return onOpen(g.b)
    if (g.mode === 'move' && isPast(g.day, g.minute)) return
    onMove(g.b, g.day, g.minute, g.mode === 'resize' ? g.dur : g.b.dur)
  }

  const nowLocal = localDayMinute(new Date(now), timeZone)
  const hours: number[] = []
  for (let hh = Math.ceil(startMin / 60); hh * 60 < endMin; hh++) if (hh * 60 > startMin) hours.push(hh)
  const dayLoad = (d: string) => blocks.filter((b) => b.day === d && b.type !== 'fixed' && b.type !== 'buffer').reduce((a, b) => a + b.dur, 0)

  return (
    <div className="flex min-h-[420px] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card shadow-soft">
      <div className="flex border-b">
        <div className="w-11 shrink-0" />
        {days.map((d) => (
          <div key={d} className="flex-1 border-l py-1.5 text-center first:border-l-0">
            <div className="text-xs font-extrabold text-muted-foreground">{DOW[dayOfWeek(d)]}</div>
            <div className={`mx-auto mt-0.5 w-8 rounded-lg text-base font-black tabular ${d === today ? 'bg-primary text-primary-foreground' : ''}`}>{Number(d.slice(8))}</div>
            <div className="mx-auto mt-1 h-1 w-3/5 overflow-hidden rounded-full bg-muted" title={`${fmtMinutes(dayLoad(d))} planned`}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (dayLoad(d) / 360) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div ref={body} className="relative flex min-h-0 flex-1">
        <div className="relative w-11 shrink-0">
          {hours.map((hh) => <span key={hh} className="absolute right-1.5 -translate-y-1/2 text-[10px] font-bold text-muted-foreground tabular" style={{ top: y(hh * 60) }}>{String(hh).padStart(2, '0')}</span>)}
        </div>
        {days.map((d) => {
          const slots = Math.floor((endMin - startMin) / SLOT)
          return (
            <div key={d} data-col={d} className={`relative flex-1 touch-none select-none border-l first:border-l-0 ${d === today ? 'bg-accent/25' : ''} ${placing ? 'cursor-pointer' : 'cursor-crosshair'}`}
              onPointerDown={(e) => onPointerDown(e, d)} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const raw = e.dataTransfer.getData('application/x-plan')
                if (!raw) return
                const data = JSON.parse(raw) as { chip?: Chip }
                const m = minuteAt(e.currentTarget, e.clientY)
                if (data.chip && !isPast(d, m)) onDropChip(d, m, data.chip)
              }}>
              {hours.map((hh) => <div key={hh} className="pointer-events-none absolute inset-x-0 border-t border-border/50" style={{ top: y(hh * 60) }} />)}
              {strongHours.map((hh) => hh * 60 >= startMin && hh * 60 < endMin && (
                <div key={hh} className="pointer-events-none absolute inset-x-0 bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--leaf)_11%,transparent)_0_6px,transparent_6px_12px)]" style={{ top: y(hh * 60), height: 60 * ppm }} />
              ))}
              {/* 30-minute slots: tap targets for placing (and labels for assistive tech) */}
              {Array.from({ length: slots }, (_, r) => {
                const minute = startMin + r * SLOT
                const past = localToUtc(d, minute + SLOT, timeZone).getTime() < now
                return (
                  <div key={r} role="button" tabIndex={-1} aria-label={`${d} ${fmtTime(minute)}`}
                    onClick={() => placing && !past && onPlace(d, minute)}
                    className={`absolute inset-x-0 ${past ? 'bg-muted/35' : placing ? 'hover:bg-accent/60' : ''}`} style={{ top: y(minute), height: SLOT * ppm }} />
                )
              })}
              {blocks.filter((b) => (live?.id === b.id ? live.day : b.day) === d).map((b) => {
                const pos = live?.id === b.id ? live : b
                const top = y(Math.max(pos.minute, startMin))
                const height = Math.max(14, (Math.min(pos.minute + pos.dur, endMin) - Math.max(pos.minute, startMin)) * ppm - 2)
                return <BlockCard key={b.id} b={b} top={top} height={height} minute={pos.minute} dur={pos.dur} wide={wide} nowMs={now} dragging={live?.id === b.id} />
              })}
              {ghost?.day === d && (
                <div className="pointer-events-none absolute inset-x-1 z-20 rounded-lg border-2 border-dashed border-primary bg-accent/80 px-1.5 py-0.5 text-[11px] font-black text-primary tabular"
                  style={{ top: y(ghost.a), height: (ghost.b - ghost.a) * ppm }}>
                  {fmtTime(ghost.a)}–{fmtTime(ghost.b)} · {fmtMinutes(ghost.b - ghost.a)}
                </div>
              )}
              {d === nowLocal.key && nowLocal.minute >= startMin && nowLocal.minute <= endMin && (
                <>
                  <div className="pointer-events-none absolute inset-x-0 z-30 h-0.5 bg-rose-500" style={{ top: y(nowLocal.minute) }}>
                    <span className="absolute -left-1 -top-1 size-2.5 rounded-full bg-rose-500" />
                  </div>
                  <span className="pointer-events-none absolute right-1 z-30 -translate-y-1/2 rounded bg-card px-1 text-[10px] font-black text-rose-500 tabular" style={{ top: y(nowLocal.minute) }}>{fmtTime(nowLocal.minute)}</span>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BlockCard({ b, top, height, minute, dur, wide, nowMs, dragging }: {
  b: Positioned; top: number; height: number; minute: number; dur: number; wide: boolean; nowMs: number; dragging: boolean
}) {
  const color = b.subject?.color ?? null
  const fixed = b.type === 'fixed'
  const running = !b.outcome && b.started && new Date(b.start).getTime() <= nowMs && new Date(b.end).getTime() > nowMs
  const movable = !fixed && !b.outcome
  const icon = b.outcome === 'kept' ? '✓' : b.outcome === 'missed' ? '✗' : b.outcome === 'released' ? '↩' : fixed ? '🔒' : running ? '●' : b.status === 'committed' ? '' : ''
  const bg = fixed ? 'var(--muted)' : `color-mix(in oklab, ${tint(color)} ${b.outcome ? 12 : 20}%, var(--card))`
  return (
    <div data-block-id={b.id} title={b.ifThen ?? b.title}
      className={`absolute inset-x-1 z-10 overflow-hidden rounded-lg border-l-4 px-1.5 py-0.5 text-[11px] font-extrabold leading-tight transition-shadow hover:z-20 hover:shadow-soft
        ${movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${fixed ? 'border-dotted text-muted-foreground' : ''}
        ${b.outcome === 'kept' ? 'opacity-70' : ''} ${b.outcome === 'missed' ? 'bg-[repeating-linear-gradient(135deg,transparent_0_5px,rgba(228,111,111,.14)_5px_10px)] opacity-75' : ''}
        ${b.outcome === 'released' ? 'line-through opacity-50' : ''} ${running ? 'ring-2 ring-primary' : ''} ${dragging ? 'z-30 opacity-90 shadow-lg' : ''}`}
      style={{ top, height, background: b.outcome === 'missed' ? undefined : bg, borderLeftColor: fixed ? 'var(--muted-foreground)' : tint(color) }}>
      <span className="flex items-center gap-1 pr-3">
        {b.status === 'committed' && !b.outcome && <Lock className="size-2.5 shrink-0 opacity-60" />}
        {b.seriesId && <Repeat className="size-2.5 shrink-0 opacity-60" />}
        <span className="truncate">{b.title}</span>
      </span>
      {icon && <span className={`absolute right-1 top-0.5 text-[10px] ${b.outcome === 'missed' ? 'text-rose-500' : ''}`} style={b.outcome === 'missed' ? undefined : { color: tint(color) }}>{icon}</span>}
      {height > 28 && <span className="block truncate font-bold opacity-70 tabular">{fmtTime(minute)}–{fmtTime(minute + dur)}{wide && b.subject ? ` · ${b.subject.name}` : ''}{b.outcome && b.outcome !== 'kept' ? ` · ${b.outcome}` : ''}</span>}
      {movable && <span data-resize="1" aria-hidden className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize" />}
    </div>
  )
}

// ───────────── day side panel ─────────────

function DayPanel({ day, blocks, nowMs, timeZone }: { day: string; blocks: Positioned[]; nowMs: number; timeZone: string }) {
  const mine = blocks.filter((b) => b.type !== 'fixed' && b.type !== 'buffer')
  const planned = mine.reduce((a, b) => a + b.dur, 0)
  const kept = mine.filter((b) => b.outcome === 'kept')
  const next = mine.filter((b) => !b.outcome && new Date(b.end).getTime() > nowMs).sort((a, b) => a.start.localeCompare(b.start))[0]
  const startsIn = next ? Math.round((new Date(next.start).getTime() - nowMs) / 60_000) : null
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-3 lg:flex">
      <div className="rounded-2xl bg-card p-4 shadow-soft">
        <p className="text-xs font-extrabold text-muted-foreground">{fmtDay(day)} at a glance</p>
        <p className="text-3xl font-black tabular">{fmtMinutes(kept.reduce((a, b) => a + b.dur, 0))} <span className="text-base text-muted-foreground">of {fmtMinutes(planned)} done</span></p>
        <p className="text-xs font-bold text-muted-foreground">{kept.length} kept · {mine.filter((b) => b.outcome === 'missed').length} missed · {mine.filter((b) => !b.outcome).length} to go</p>
      </div>
      {next && (
        <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-soft">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-muted-foreground">{startsIn !== null && startsIn > 0 ? `Next · in ${fmtMinutes(startsIn)}` : 'Now'}</p>
            <p className="truncate font-black">{next.title}</p>
            <p className="text-xs font-bold text-muted-foreground tabular">{fmtTime(localDayMinute(new Date(next.start), timeZone).minute)}{next.subject ? ` · ${next.subject.name}` : ''}</p>
          </div>
          {startsIn !== null && startsIn <= 10 && (
            <Link href={next.type === 'speaking' ? `/speak/drill?block=${next.id}` : `/launch/${next.id}`} aria-label={`Start ${next.title}`}
              className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Play className="size-4 fill-current" /></Link>
          )}
        </div>
      )}
      <p className="rounded-2xl bg-card p-4 text-xs font-bold text-muted-foreground shadow-soft">Drag down on an empty time to block it, then press <b className="text-foreground">Enter</b>. Green stripes are the hours you usually keep.</p>
    </aside>
  )
}

// ───────────── create popover ─────────────

function CreatePopover({ at, projects, goals, tasks, commit, timeZone, onClose }: {
  at: { day: string; minute: number; dur: number; x: number; y: number }
  projects: ProjectBudget[]; goals: { id: string; title: string }[]; tasks: { id: string; title: string }[]
  commit: boolean; timeZone: string; onClose: () => void
}) {
  const { pending, run } = useTaskMutation()
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [type, setType] = useState<'focus' | 'speaking' | 'ritual' | 'recovery' | 'buffer'>('focus')
  const [repeat, setRepeat] = useState<'once' | 'weekdays' | 'daily' | 'weekly'>('once')
  const [more, setMore] = useState(false)
  const [goalId, setGoalId] = useState('')
  const [taskId, setTaskId] = useState('')
  const project = projects.find((p) => p.id === projectId)
  const name = title.trim() || tasks.find((t) => t.id === taskId)?.title || goals.find((g) => g.id === goalId)?.title || project?.name || ''
  const dow = dayOfWeek(at.day)
  const save = () => {
    if (!name || pending) return
    run(async () => {
      const r = await createBlock({
        type, title: name, start: localToUtc(at.day, at.minute, timeZone).toISOString(), minutes: at.dur,
        taskId: taskId || null, goalId: goalId || null, projectId: projectId || null, timerMode: null, commit: commit && type !== 'buffer',
        repeatWeekdays: repeat === 'weekdays' ? [0, 1, 2, 3, 4] : repeat === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : repeat === 'weekly' ? [dow] : [],
      })
      if (r.ok) onClose()
      return r
    }, repeat === 'once' ? 'Block added.' : 'Repeating block added.')
  }
  const left = typeof window === 'undefined' ? 0 : Math.max(8, Math.min(window.innerWidth - 328, at.x + 14))
  const top = typeof window === 'undefined' ? 0 : Math.max(8, Math.min(window.innerHeight - 380, at.y - 40))
  return (
    <>
      <div className="fixed inset-0 z-40" onPointerDown={onClose} aria-hidden />
      <div role="dialog" aria-label="New block" className="fixed z-50 flex w-80 flex-col gap-2.5 rounded-2xl bg-popover p-3.5 shadow-2xl ring-1 ring-border animate-pop" style={{ left, top }}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}>
        <p className="text-xs font-extrabold text-muted-foreground tabular">{fmtDay(at.day)} · {fmtTime(at.minute)}–{fmtTime(at.minute + at.dur)} · {fmtMinutes(at.dur)}</p>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={project ? project.name : 'What will you do?'} aria-label="Block title" maxLength={200}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
          className="h-11 rounded-xl border-2 border-primary bg-background px-3 font-extrabold outline-none" />
        {projects.length > 0 && (
          <Choice label="Subject" size="sm" value={projectId} onChange={setProjectId}
            options={[{ value: '', label: 'None', dot: null }, ...projects.map((p) => ({ value: p.id, label: p.name, dot: p.color }))]} />
        )}
        <Chips label="Repeat" size="sm" value={repeat} onChange={setRepeat}
          options={[{ value: 'once', label: 'Once' }, { value: 'weekdays', label: 'Weekdays' }, { value: 'daily', label: 'Every day' }, { value: 'weekly', label: `Every ${DOW[dow]}` }]} />
        {more ? (
          <div className="space-y-2">
            <Chips label="Type" size="sm" value={type} onChange={setType} options={[
              { value: 'focus', label: 'Focus', emoji: '🎯' }, { value: 'speaking', label: 'Speaking', emoji: '🎤' }, { value: 'ritual', label: 'Routine', emoji: '🔁' },
              { value: 'recovery', label: 'Rest', emoji: '🌿' }, { value: 'buffer', label: 'Buffer', emoji: '⏳' },
            ]} />
            {goals.length > 0 && <Choice label="Goal" value={goalId} onChange={setGoalId} sheetTitle="Which goal?" options={[{ value: '', label: 'No goal' }, ...goals.map((g) => ({ value: g.id, label: g.title }))]} />}
            {tasks.length > 0 && <Choice label="Task" value={taskId} onChange={setTaskId} sheetTitle="Which task?" options={[{ value: '', label: 'No task' }, ...tasks.map((t) => ({ value: t.id, label: t.title }))]} />}
          </div>
        ) : (
          <button className="self-start text-xs font-bold text-muted-foreground hover:text-foreground" onClick={() => setMore(true)}>More: type, goal, task…</button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Esc to cancel</span>
          <Button className="ml-auto" disabled={!name || pending} onClick={save}>Add<Kbd>Enter ↵</Kbd></Button>
        </div>
      </div>
    </>
  )
}
