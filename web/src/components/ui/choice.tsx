'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, ChevronRight, Minus, Plus, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

export interface ChoiceOption<T extends string | number> {
  value: T
  label: string
  /** A coloured dot (project colours) or an emoji shown before the label. */
  dot?: string | null
  emoji?: string
  hint?: string
}

const CHIP_LIMIT = 6

/**
 * Pick one of a few things without a dropdown. Up to six options show as tappable chips; longer lists
 * (projects, goals, tasks) open a sheet with a search box — type to filter, ↑↓ to move, Enter to pick.
 */
export function Choice<T extends string | number>({ label, value, options, onChange, size = 'md', sheetTitle }: {
  label: string; value: T; options: ChoiceOption<T>[]; onChange: (v: T) => void; size?: 'sm' | 'md'; sheetTitle?: string
}) {
  if (options.length <= CHIP_LIMIT) return <Chips label={label} value={value} options={options} onChange={onChange} size={size} />
  return <PickSheet label={label} title={sheetTitle ?? label} value={value} options={options} onChange={onChange} />
}

function Mark({ o }: { o: { dot?: string | null; emoji?: string } }) {
  if (o.emoji) return <span aria-hidden>{o.emoji}</span>
  if (o.dot !== undefined) return <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: o.dot ? `var(--project-${o.dot})` : 'var(--muted-foreground)', opacity: o.dot ? 1 : 0.35 }} />
  return null
}

export function Chips<T extends string | number>({ label, value, options, onChange, size = 'md' }: {
  label: string; value: T; options: ChoiceOption<T>[]; onChange: (v: T) => void; size?: 'sm' | 'md'
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} title={o.hint} onClick={() => onChange(o.value)}
            className={`flex items-center gap-1.5 rounded-full border-2 font-bold transition-colors duration-150 ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${on ? 'border-primary bg-accent text-accent-foreground' : 'border-transparent bg-muted text-muted-foreground hover:text-foreground'}`}>
            <Mark o={o} />{o.label}
          </button>
        )
      })}
    </div>
  )
}

function PickSheet<T extends string | number>({ label, title, value, options, onChange }: {
  label: string; title: string; value: T; options: ChoiceOption<T>[]; onChange: (v: T) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const list = useRef<HTMLUListElement>(null)
  const current = options.find((o) => o.value === value)
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options
  }, [q, options])
  const pick = (o: ChoiceOption<T>) => { onChange(o.value); setOpen(false) }
  const openSheet = () => {
    setQ('')
    setCursor(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  const move = (d: number) => {
    const n = Math.max(0, Math.min(shown.length - 1, cursor + d))
    setCursor(n)
    list.current?.children[n]?.scrollIntoView({ block: 'nearest' })
  }

  return (
    <>
      <button type="button" onClick={openSheet} aria-label={`${label}: ${current?.label ?? 'none'}`} aria-haspopup="dialog"
        className="flex h-10 w-full items-center gap-2 rounded-xl border-2 border-transparent bg-muted px-3 text-left text-sm font-bold transition-colors hover:border-border">
        {current && <Mark o={current} />}
        <span className="min-w-0 flex-1 truncate">{current?.label ?? 'Choose…'}</span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-3 rounded-3xl p-4 sm:max-w-sm">
          <DialogTitle className="font-extrabold">{title}</DialogTitle>
          <label className="flex items-center gap-2 rounded-xl border-2 border-border bg-background px-3 focus-within:border-primary">
            <Search className="size-4 text-muted-foreground" />
            <input autoFocus value={q} aria-label={`Search ${label}`} placeholder="Type to find…" data-no-step-keys
              onChange={(e) => { setQ(e.target.value); setCursor(0) }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
                else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
                else if (e.key === 'Enter' && shown[cursor]) { e.preventDefault(); e.stopPropagation(); pick(shown[cursor]) }
              }}
              className="h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" />
          </label>
          <ul ref={list} role="listbox" aria-label={label} className="-mx-1 max-h-72 space-y-0.5 overflow-y-auto px-1">
            {shown.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted-foreground">Nothing matches.</li>}
            {shown.map((o, i) => (
              <li key={String(o.value)} role="option" aria-selected={o.value === value}>
                <button type="button" onClick={() => pick(o)} onMouseEnter={() => setCursor(i)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold ${i === cursor ? 'bg-accent' : ''}`}>
                  <Mark o={o} />
                  <span className="min-w-0 flex-1"><span className="block truncate">{o.label}</span>{o.hint && <span className="block text-xs font-semibold text-muted-foreground">{o.hint}</span>}</span>
                  {o.value === value && <Check className="size-4 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** "− 7:00 +" for hours of the day; `max` may be 24 (midnight at the end of the day). */
export function HourStepper({ label, value, onChange, min = 0, max = 23 }: {
  label: string; value: number; onChange: (h: number) => void; min?: number; max?: number
}) {
  const fmt = (h: number) => `${String(h % 24).padStart(2, '0')}:00${h === 24 ? ' (midnight)' : ''}`
  const btn = 'flex size-8 items-center justify-center rounded-lg bg-card shadow-soft disabled:opacity-40'
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-1 rounded-xl bg-muted p-1">
      <button type="button" className={btn} aria-label={`${label} earlier`} disabled={value <= min} onClick={() => onChange(value - 1)}><Minus className="size-3.5" /></button>
      <span className="min-w-14 text-center text-sm font-extrabold tabular" aria-live="polite">{fmt(value)}</span>
      <button type="button" className={btn} aria-label={`${label} later`} disabled={value >= max} onClick={() => onChange(value + 1)}><Plus className="size-3.5" /></button>
    </div>
  )
}

/** "− 3 +" for small counts (caps, budgets, days). */
export function NumberStepper({ label, value, onChange, min, max, step = 1, unit }: {
  label: string; value: number; onChange: (n: number) => void; min: number; max: number; step?: number; unit?: string
}) {
  const btn = 'flex size-8 items-center justify-center rounded-lg bg-card shadow-soft disabled:opacity-40'
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-1 rounded-xl bg-muted p-1">
      <button type="button" className={btn} aria-label={`Less ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}><Minus className="size-3.5" /></button>
      <span className="min-w-12 text-center text-sm font-extrabold tabular" aria-live="polite">{value}{unit ? ` ${unit}` : ''}</span>
      <button type="button" className={btn} aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}><Plus className="size-3.5" /></button>
    </div>
  )
}
