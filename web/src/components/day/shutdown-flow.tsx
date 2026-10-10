'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowRight, Check, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { useStepKeys } from '@/lib/client/use-step-keys'
import { closeDay, reopenDay, shutdownMove } from '@/app/actions/day'
import { saveReflection } from '@/app/actions/training'
import { useTaskMutation } from '@/components/tasks/task-actions'
import { ProjectDot } from '@/components/tasks/task-chips'
import { say, type Tone } from '@/domain/guide/copy'
import { fmtMinutes } from '@/lib/format'

/** Evening shutdown (DESIGN §13.7): resolve leftovers → Done Wall → Day closed. */
export function ShutdownFlow(props: {
  tone: Tone; closed: boolean
  leftovers: { id: string; title: string }[]
  done: { id: string; title: string; color: string | null }[]
  focusMinutes: number; sessions: number; cleanLadder: number; rungClimb: number | null
  projects: { name: string; color: string; minutes: number }[]
  reflection: { question: string; text: string }
}) {
  const [step, setStep] = useState<1 | 2 | 3>(props.closed ? 3 : props.leftovers.length ? 1 : 2)
  const { pending, run } = useTaskMutation()
  const [handled, setHandled] = useState<Set<string>>(new Set())
  const [reflection, setReflection] = useState(props.reflection.text)
  const open = props.leftovers.filter((l) => !handled.has(l.id))
  const move = (id: string, to: 'tomorrow' | 'backlog' | 'done') =>
    run(async () => {
      const r = await shutdownMove({ id, to })
      if (r.ok) setHandled((h) => new Set(h).add(id))
      return r
    })
  const maxMinutes = Math.max(1, ...props.projects.map((p) => p.minutes))
  const router = useRouter()
  const close = () => {
    if (pending) return
    run(async () => {
      if (reflection.trim() !== props.reflection.text.trim()) {
        const s = await saveReflection(reflection)
        if (!s.ok) return s
      }
      const r = await closeDay()
      if (r.ok) setStep(3)
      return r
    })
  }
  // Enter moves on (leftovers → done wall → close → home); Esc steps back.
  useStepKeys({
    onNext: () => (step === 1 ? setStep(2) : step === 2 ? close() : router.push('/')),
    onBack: () => (step === 2 && props.leftovers.length ? setStep(1) : router.push('/')),
  })

  return (
    <div className="mx-auto max-w-xl space-y-8">
      {step === 1 && (
        <section className="space-y-5">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Before you close 🌆</h1>
            <p className="mt-1 text-sm text-muted-foreground">Give every open item a home. Nothing gets left hanging.</p>
          </div>
          {open.length === 0 ? <p className="text-sm text-muted-foreground">All resolved.</p> : (
            <ul className={`divide-y rounded-2xl bg-card shadow-soft ${pending ? 'opacity-60' : ''}`}>
              {open.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate">{l.title}</span>
                  <Button size="sm" variant="ghost" onClick={() => move(l.id, 'done')}><Check className="size-3.5" /> Done</Button>
                  <Button size="sm" variant="outline" onClick={() => move(l.id, 'tomorrow')}>Tomorrow</Button>
                  <Button size="sm" variant="ghost" onClick={() => move(l.id, 'backlog')}>Soon</Button>
                </li>
              ))}
            </ul>
          )}
          <Button size="lg" className="h-11 w-full" onClick={() => setStep(2)}>See your day <ArrowRight className="size-4" /><Kbd>Enter ↵</Kbd></Button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">Done wall</p>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {props.done.length} done · {fmtMinutes(props.focusMinutes)} focused
            </h1>
          </div>
          {props.rungClimb && (
            <div className="animate-settle rounded-xl bg-success-muted px-4 py-3 text-sm">{say(props.tone, 'climbed', { rung: props.rungClimb })}</div>
          )}
          {props.done.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {props.done.map((d, i) => (
                <div key={d.id} className="animate-settle rounded-2xl bg-card shadow-soft px-3 py-2.5 text-sm" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="flex items-start gap-2"><ProjectDot color={d.color} /><span>{d.title}</span></div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No tasks completed today — {props.sessions ? `but ${props.sessions} focus session${props.sessions > 1 ? 's' : ''} happened. That counts.` : 'some days are like that. Tomorrow is a fresh start.'}
            </p>
          )}
          {props.projects.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">Focus by project</h2>
              {props.projects.map((p) => (
                <div key={p.name} className="flex items-center gap-3 text-sm">
                  <span className="w-28 truncate">{p.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${(p.minutes / maxMinutes) * 100}%`, background: `var(--project-${p.color})` }} />
                  </div>
                  <span className="w-14 text-right tabular text-muted-foreground">{fmtMinutes(p.minutes)}</span>
                </div>
              ))}
            </div>
          )}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{props.reflection.question}</span>
            <input value={reflection} onChange={(e) => setReflection(e.target.value)} maxLength={500}
              placeholder="Optional — one honest line is enough."
              className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary" />
          </label>
          <Button size="lg" className="h-11 w-full" disabled={pending} onClick={close}>
            <Moon className="size-4" /> Close the day<Kbd>Enter ↵</Kbd>
          </Button>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4 py-16 text-center">
          <Moon className="mx-auto size-8 text-primary" />
          <h1 className="text-2xl font-extrabold">{say(props.tone, 'closed')}</h1>
          <p className="text-sm text-muted-foreground">{props.done.length} done · {fmtMinutes(props.focusMinutes)} focused</p>
          <div className="flex justify-center gap-3 pt-4 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">Home<Kbd>Enter ↵</Kbd></Link>
            <button className="text-muted-foreground hover:text-foreground" onClick={() => run(() => reopenDay(), 'Day reopened.')}>Reopen day</button>
          </div>
        </section>
      )}
    </div>
  )
}
