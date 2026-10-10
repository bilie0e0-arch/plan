'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { recordDecision } from '@/app/actions/guide'
import { takeBreakNow } from '@/app/actions/focus'
import type { NowCard as NowCardData } from '@/domain/guide/now-card'

/**
 * The Now card (DESIGN §10.4): always one next step.
 * Fading (§10.13): in "ask" mode the user picks first; the suggestion only appears on request.
 */
export function NowCard({ card }: { card: NowCardData }) {
  const router = useRouter()
  const [reveal, setReveal] = useState(false)
  const [showAlts, setShowAlts] = useState(false)
  const [, start] = useTransition()

  const choose = (taskId: string, source: 'self' | 'suggestion_accepted') =>
    start(async () => {
      await recordDecision('next_task', source)
      router.push(`/focus?task=${taskId}`)
    })

  if (card.kind === 'break') {
    return (
      <Shell message={card.message}>
        <Button onClick={() => start(async () => { await takeBreakNow(10); router.push('/focus/break?m=10') })}>Take a 10-minute break</Button>
      </Shell>
    )
  }

  if (card.askFirst && card.task) {
    return (
      <Shell message={card.message} why={reveal ? card.why : null}>
        <div className="flex flex-wrap gap-2">
          {card.alternatives.slice(0, 4).map((t) => (
            <Button key={t.id} variant={reveal && t.id === card.task!.id ? 'default' : 'outline'}
              onClick={() => choose(t.id, reveal && t.id === card.task!.id ? 'suggestion_accepted' : 'self')}>
              {t.title}
            </Button>
          ))}
        </div>
        {!reveal && <button className="mt-3 text-xs text-muted-foreground hover:text-foreground" onClick={() => setReveal(true)}>Show suggestion</button>}
      </Shell>
    )
  }

  return (
    <Shell message={card.message} why={card.why}>
      <div className="flex flex-wrap items-center gap-2">
        {card.task ? (
          <Button size="lg" className="h-10 px-4" onClick={() => choose(card.task!.id, 'suggestion_accepted')}>
            {card.actionLabel} <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Link href={card.href}><Button size="lg" className="h-10 px-4">{card.actionLabel} <ArrowRight className="size-4" /></Button></Link>
        )}
        {card.alternatives.length > 0 && (
          <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowAlts((s) => !s)}>Something else</button>
        )}
      </div>
      {showAlts && (
        <div className="mt-3 flex flex-wrap gap-2">
          {card.alternatives.map((t) => (
            <Button key={t.id} variant="outline" size="sm" onClick={() => choose(t.id, 'self')}>{t.title}</Button>
          ))}
        </div>
      )}
    </Shell>
  )
}

function Shell({ message, why, children }: { message: string; why?: string | null; children: React.ReactNode }) {
  return (
    <section aria-label="Now" className="rounded-2xl bg-card shadow-soft p-5 shadow-xs">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
        <Sparkles className="size-3.5" /> Now
      </div>
      <p className="text-lg font-medium leading-snug">{message}</p>
      {why && <p className="mt-1 text-sm text-muted-foreground">{why}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
