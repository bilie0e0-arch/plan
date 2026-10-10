'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Kbd } from '@/components/ui/kbd'
import { addDays, dayOfWeek, weekStart } from '@/domain/time/day'
import { fmtMinutes } from '@/lib/format'
import type { MonthDay } from '@/lib/data/calendar'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** A month at a glance: how full each day is, which subjects appear, how much was kept. Tap a day to open it. */
export function MonthView({ month, today, days }: { month: string; today: string; days: MonthDay[] }) {
  const router = useRouter()
  const lead = dayOfWeek(days[0]!.key)
  const cells: (MonthDay | null)[] = [...Array.from({ length: lead }, () => null), ...days]
  while (cells.length % 7) cells.push(null)
  const label = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
  const openDay = (key: string) => router.push(`/calendar?view=day&week=${weekStart(key)}&day=${key}`)
  const total = days.reduce((a, d) => a + d.plannedMinutes, 0)
  const finished = days.reduce((a, d) => a + d.finished, 0)
  const kept = days.reduce((a, d) => a + d.kept, 0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target instanceof HTMLElement ? e.target : null
      if (e.ctrlKey || e.metaKey || e.altKey || (t && ['INPUT', 'TEXTAREA'].includes(t.tagName))) return
      const k = e.key.toLowerCase()
      if (k === 'd') router.push(`/calendar?view=day`)
      else if (k === 'w') router.push(`/calendar?view=week`)
      else if (k === 't') router.push(`/calendar?view=month`)
      else if (e.key === 'ArrowLeft') router.push(`/calendar?view=month&month=${shiftMonth(month, -1)}`)
      else if (e.key === 'ArrowRight') router.push(`/calendar?view=month&month=${shiftMonth(month, 1)}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [month, router])

  return (
    <div className="flex flex-col gap-3 md:h-[calc(100dvh-8.5rem)]">
      <header className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-2xl font-black tracking-tight">Plan</h1>
        <div className="flex rounded-xl bg-muted p-1" role="tablist" aria-label="Calendar view">
          {(['day', 'week', 'month'] as const).map((v) => (
            <Link key={v} role="tab" aria-selected={v === 'month'} href={`/calendar?view=${v}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-extrabold capitalize ${v === 'month' ? 'bg-card shadow-soft' : 'text-muted-foreground'}`}>{v}<Kbd>{v[0]!.toUpperCase()}</Kbd></Link>
          ))}
        </div>
        <div className="flex items-center text-sm font-bold">
          <Link href={`/calendar?view=month&month=${shiftMonth(month, -1)}`} aria-label="Previous month" className="rounded-lg p-1.5 hover:bg-muted"><ChevronLeft className="size-4" /></Link>
          <Link href="/calendar?view=month" className="rounded-lg px-2 py-1 hover:bg-muted">Today<Kbd>T</Kbd></Link>
          <Link href={`/calendar?view=month&month=${shiftMonth(month, 1)}`} aria-label="Next month" className="rounded-lg p-1.5 hover:bg-muted"><ChevronRight className="size-4" /></Link>
          <span className="ml-1 text-muted-foreground">{label}</span>
        </div>
        <span className="ml-auto text-xs font-bold text-muted-foreground">{fmtMinutes(total)} planned{finished ? ` · ${Math.round((kept / finished) * 100)}% kept so far` : ''}</span>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-1.5 rounded-2xl bg-card p-2 shadow-soft" style={{ gridTemplateRows: `auto repeat(${cells.length / 7}, minmax(64px, 1fr))` }}>
        {DOW.map((d) => <div key={d} className="pb-1 text-center text-xs font-extrabold text-muted-foreground">{d}</div>)}
        {cells.map((c, i) => c ? (
          <button key={c.key} onClick={() => openDay(c.key)} aria-label={`${c.key}: ${fmtMinutes(c.plannedMinutes)} planned`}
            className={`flex flex-col gap-1 rounded-xl border-2 p-1.5 text-left transition-colors hover:border-primary ${c.key === today ? 'border-primary' : 'border-transparent'}`}
            style={{ background: c.plannedMinutes ? `color-mix(in oklab, var(--accent) ${Math.min(100, 25 + c.plannedMinutes / 6)}%, var(--card))` : 'var(--muted)' }}>
            <span className="text-sm font-black tabular">{Number(c.key.slice(8))}</span>
            <span className="flex flex-wrap gap-0.5">{c.colors.map((col) => <i key={col} className="size-2 rounded-full" style={{ background: `var(--project-${col})` }} />)}</span>
            {c.plannedMinutes > 0 && (
              <span className="mt-auto hidden text-[11px] font-bold text-muted-foreground tabular sm:block">
                {fmtMinutes(c.plannedMinutes)}{c.finished ? ` · ${Math.round((c.kept / c.finished) * 100)}% kept` : ''}
              </span>
            )}
          </button>
        ) : <span key={`x${i}`} />)}
      </div>
      <p className="text-xs text-muted-foreground">Tap a day to open it. Darker = more planned. Dots = subjects. <Link className="text-primary hover:underline" href={`/calendar?view=week&week=${weekStart(addDays(`${month}-01`, 0))}`}>Back to the week</Link></p>
    </div>
  )
}
