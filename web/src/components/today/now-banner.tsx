'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { takeBreakNow } from '@/app/actions/focus'
import type { NowCard } from '@/domain/guide/now-card'

const EMOJI: Record<string, string> = {
  resume: '⏱️', block: '🧱', heads_up: '⏳', closed: '🌙', plan_day: '🗺️', break: '☕', shutdown: '🌆', gap: '⚡', process_inbox: '💡', empty: '🌤️',
}
const TINT: Record<string, string> = {
  block: 'bg-sky-soft', heads_up: 'bg-sky-soft', break: 'bg-sun-soft', closed: 'bg-lilac-soft', shutdown: 'bg-lilac-soft', plan_day: 'bg-accent', gap: 'bg-sun-soft',
}

/** The Guide's one suggestion when it isn't simply "start this task" (that one is marked on the task itself). */
export function NowBanner({ card }: { card: NowCard }) {
  const router = useRouter()
  const [, start] = useTransition()
  return (
    <section aria-label="Now" className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 animate-pop ${TINT[card.kind] ?? 'bg-muted'}`}>
      <span className="text-2xl" aria-hidden>{EMOJI[card.kind] ?? '✨'}</span>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold leading-snug">{card.message}</p>
        {card.why && <p className="text-sm text-muted-foreground">{card.why}</p>}
      </div>
      {card.kind === 'break'
        ? <button onClick={() => start(async () => { await takeBreakNow(10); router.push('/focus/break?m=10') })} className="rounded-xl bg-card px-4 py-2 text-sm font-bold shadow-soft hover:bg-card/80">Take a break</button>
        : <Link href={card.href} className="rounded-xl bg-card px-4 py-2 text-sm font-bold shadow-soft hover:bg-card/80">{card.actionLabel}</Link>}
    </section>
  )
}
