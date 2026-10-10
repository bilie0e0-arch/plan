'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { WrappedCard } from '@/lib/data/review'

/** Story-format recap (DESIGN §13.20): tap or swipe through, ends on "Plan next week". */
export function WeekWrapped({ cards, onDone }: { cards: WrappedCard[]; onDone: () => void }) {
  const [i, setI] = useState(0)
  const last = i === cards.length - 1
  const next = useCallback(() => (last ? onDone() : setI((x) => x + 1)), [last, onDone])
  const prev = useCallback(() => setI((x) => Math.max(0, x - 1)), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev])
  const [touchX, setTouchX] = useState<number | null>(null)
  const c = cards[i]!

  return (
    <div className="relative flex min-h-[26rem] select-none flex-col overflow-hidden rounded-3xl bg-[oklch(0.22_0.03_200)] p-6 text-white"
      onTouchStart={(e) => setTouchX(e.touches[0]!.clientX)}
      onTouchEnd={(e) => {
        if (touchX === null) return
        const dx = e.changedTouches[0]!.clientX - touchX
        if (dx < -40) next()
        else if (dx > 40) prev()
        setTouchX(null)
      }}>
      <div className="flex gap-1" aria-hidden>
        {cards.map((_, k) => (
          <div key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
            <div className={`h-full rounded-full bg-white transition-all duration-300 ${k <= i ? 'w-full' : 'w-0'}`} />
          </div>
        ))}
      </div>
      <button aria-label="Previous card" className="absolute inset-y-10 left-0 w-1/3" onClick={prev} />
      <button aria-label="Next card" className="absolute inset-y-10 right-0 w-2/3" onClick={next} />
      <div key={c.id} className="pointer-events-none my-auto space-y-4 py-8 animate-in fade-in slide-in-from-right-4 duration-300">
        <p className="text-sm uppercase tracking-wide text-white/60">{c.eyebrow}</p>
        <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">{c.headline}</h2>
        {c.compare && (
          <div className="flex items-end gap-4 tabular">
            <div><p className="text-xs text-white/50">Then</p><p className="text-2xl text-white/70">{c.compare.before}</p></div>
            <ArrowRight className="mb-2 size-5 text-white/50" />
            <div><p className="text-xs text-white/50">Now</p><p className={`text-4xl font-semibold ${c.compare.better ? 'text-teal-300' : ''}`}>{c.compare.after}</p></div>
          </div>
        )}
        {c.body && <p className="text-white/70">{c.body}</p>}
      </div>
      <div className="relative z-10 flex items-center justify-between text-sm text-white/60">
        <span className="tabular">{i + 1} / {cards.length}</span>
        <button onClick={next} className={`rounded-full px-4 py-2 font-medium ${last ? 'bg-teal-300 text-[oklch(0.2_0.02_185)]' : 'bg-white/10 text-white'}`}>
          {last ? 'Plan next week →' : 'Next'}
        </button>
      </div>
    </div>
  )
}
