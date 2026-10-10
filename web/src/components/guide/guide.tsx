'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Kbd } from '@/components/ui/kbd'
import { CHAPTERS, useTicker } from './chapters'

const SEEN_KEY = 'plan.guide.seen'

/** "How Plan works" (prototype docs/mockups/guide-ui.html): one chapter per screen, Enter to go on, Esc to close. */
export function Guide({ start, back }: { start: string; back: string }) {
  const router = useRouter()
  const [cur, setCur] = useState(() => Math.max(0, CHAPTERS.findIndex((c) => c.id === start)))
  const [seen, setSeen] = useState<Set<string>>(() => new Set([CHAPTERS[cur]!.id]))
  const c = CHAPTERS[cur]!
  const t = useTicker(c.id)
  const last = cur === CHAPTERS.length - 1

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[]
      // Restoring what this device has already seen.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSeen((s) => new Set([...saved, ...s]))
    } catch { /* storage unavailable */ }
  }, [])
  useEffect(() => {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen])) } catch { /* storage unavailable */ }
  }, [seen])

  const show = (i: number) => {
    const n = Math.max(0, Math.min(CHAPTERS.length - 1, i))
    setCur(n)
    setSeen((s) => new Set(s).add(CHAPTERS[n]!.id))
  }
  const close = () => router.push(back)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (e.key === 'Enter' && tag !== 'A' && tag !== 'BUTTON') { e.preventDefault(); if (last) close(); else show(cur + 1) }
      else if (e.key === 'ArrowRight') show(cur + 1)
      else if (e.key === 'ArrowLeft' || e.key === 'Backspace') show(cur - 1)
      else if (e.key === 'Escape') close()
      else if (/^[1-9]$/.test(e.key)) show(Number(e.key) - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })


  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <nav aria-label="Chapters" className="hidden w-64 shrink-0 flex-col gap-0.5 overflow-y-auto border-r bg-sidebar px-3.5 py-4 md:flex">
        <p className="px-2.5 text-xl font-black">How Plan works</p>
        <p className="px-2.5 pb-2 text-xs text-muted-foreground">{seen.size} of {CHAPTERS.length} seen · about 4 minutes</p>
        <div className="mx-2.5 mb-2 h-1.5 overflow-hidden rounded-full bg-border"><i className="block h-full bg-primary transition-all" style={{ width: `${(seen.size / CHAPTERS.length) * 100}%` }} /></div>
        {CHAPTERS.map((ch, i) => {
          const head = i === 0 || CHAPTERS[i - 1]!.group !== ch.group ? ch.group : null
          return (
            <div key={ch.id}>
              {head && <p className="px-2.5 pb-0.5 pt-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground">{head}</p>}
              <button onClick={() => show(i)} aria-current={i === cur ? 'step' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1 text-left text-sm font-extrabold ${i === cur ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'}`}>
                <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${ch.tint}`}>{ch.icon}</span>
                <span className="flex-1">{ch.name}</span>
                {seen.has(ch.id) && i !== cur && <span className="text-xs text-primary">✓</span>}
              </button>
            </div>
          )
        })}
      </nav>

      <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 md:px-9 md:py-5">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <span>{c.group} · {cur + 1} of {CHAPTERS.length}</span>
          <button onClick={close} className="ml-auto flex items-center gap-1 hover:text-foreground"><X className="size-4" /> Close guide <Kbd>Esc</Kbd></button>
        </div>
        <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-9">
          <div key={c.id} className="grid min-h-[300px] animate-pop place-items-center overflow-hidden rounded-[26px] bg-card p-5 shadow-soft md:min-h-[360px]">
            <c.Visual t={t} />
          </div>
          <div>
            <h1 className="mb-1.5 text-3xl font-black leading-tight tracking-tight">{c.title}</h1>
            <p className="mb-4 text-muted-foreground">{c.why}</p>
            <ol className="mb-4 space-y-3">
              {c.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3 font-bold leading-snug">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-sm font-black text-primary">{i + 1}</span><span>{s}</span>
                </li>
              ))}
            </ol>
            <p className="flex gap-2 rounded-2xl bg-sun-soft px-3.5 py-2.5 text-sm font-bold">💡 <span>{c.tip}</span></p>
            {c.keys && (
              <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-2 text-xs font-bold text-muted-foreground">
                {c.keys.map(([k, d]) => <span key={k}><kbd className="rounded-md border px-1.5 py-0.5 font-sans font-extrabold">{k}</kbd> {d}</span>)}
              </div>
            )}
          </div>
        </div>
        <div className="sticky bottom-0 mx-auto flex w-full max-w-5xl items-center gap-2.5 bg-background py-2 md:static md:py-0">
          <button onClick={() => show(cur - 1)} className={`h-12 rounded-2xl bg-muted px-5 font-extrabold ${cur ? '' : 'invisible'}`}>← Back</button>
          <div className="mx-auto hidden gap-1.5 sm:flex" aria-hidden>
            {CHAPTERS.map((ch, i) => <i key={ch.id} className={`h-2 rounded-full transition-all ${i === cur ? 'w-5 bg-primary' : 'w-2 bg-border'}`} />)}
          </div>
          {c.href && <Link href={c.href} className="ml-auto grid h-12 place-items-center rounded-2xl bg-accent px-5 font-extrabold text-primary sm:ml-0">Try it now</Link>}
          <button onClick={() => (last ? close() : show(cur + 1))} className={`h-12 rounded-2xl bg-primary px-5 font-extrabold text-primary-foreground shadow-soft ${c.href ? '' : 'ml-auto sm:ml-0'}`}>
            {last ? 'Finish' : 'Next'} <Kbd>Enter ↵</Kbd>
          </button>
        </div>
      </main>
    </div>
  )
}
