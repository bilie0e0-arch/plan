'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Moon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { useStepKeys } from '@/lib/client/use-step-keys'
import { DayFitMeter } from './day-fit-meter'
import { saveCheckin, startDay } from '@/app/actions/day'
import { moveTask } from '@/app/actions/tasks'
import { PlanGateDialog, useTaskMutation, type ProjectOption } from '@/components/tasks/task-actions'
import { Chip, ProjectDot } from '@/components/tasks/task-chips'
import type { GuideLevel } from '@/domain/skills/skills'
import type { Tone } from '@/domain/guide/copy'
import type { DayFit } from '@/domain/plan/time-honesty'

export interface Candidate {
  id: string; title: string; firstAction: string | null; estimate: number | null
  energy: 'deep' | 'shallow' | 'admin' | null; projectId: string | null; projectName: string | null; projectColor: string | null
  behind: boolean; multiplier: number; fromInbox: boolean
}

type Step = 'checkin' | 'yesterday' | 'pick' | 'fit'

const ENERGY_LABEL = ['', '😴 Drained', '🥱 Low', '🙂 Okay', '😊 Good', '⚡ Sharp']

export function PlanWizard(props: {
  level: GuideLevel; tone: Tone; energy: number | null; sleepHours: number | null; dayPlanned: boolean; yesterdayDone: number
  leftovers: { id: string; title: string; deferralCount: number }[]
  today: { id: string; title: string; estimate: number | null; adjusted: number | null; evening: boolean; projectColor: string | null }[]
  candidates: Candidate[]; projects: ProjectOption[]; wipCap: number; fit: DayFit; defaultAvailable: number
}) {
  const router = useRouter()
  // Scaffold, then fade (DESIGN §10.13): full ritual for Developing, shorter as Planning improves.
  const steps: Step[] = ['checkin']
  if (props.level === 'full' || props.leftovers.length > 0) steps.push('yesterday')
  steps.push('pick', 'fit')
  const [i, setI] = useState(props.energy ? Math.min(1, steps.length - 1) : 0)
  const step = steps[i]!
  const next = () => setI((x) => Math.min(steps.length - 1, x + 1))
  const back = () => setI((x) => Math.max(0, x - 1))

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground"><X className="inline size-4" /> Close<Kbd>Esc</Kbd></Link>
        <div className="flex gap-1.5" aria-label={`Step ${i + 1} of ${steps.length}`}>
          {steps.map((s, k) => <span key={s} className={`h-1.5 w-6 rounded-full ${k <= i ? 'bg-primary' : 'bg-muted'}`} />)}
        </div>
        <span className="w-12" />
      </div>
      {step === 'checkin' && <Checkin initial={props.energy} sleep={props.sleepHours} onDone={next} onClose={() => router.push('/')} />}
      {step === 'yesterday' && <Yesterday done={props.yesterdayDone} leftovers={props.leftovers} onBack={back} onDone={next} />}
      {step === 'pick' && <Pick {...props} onBack={back} onDone={next} />}
      {step === 'fit' && (
        <Fit fit={props.fit} defaultAvailable={props.defaultAvailable} level={props.level} onBack={back}
          onDone={() => router.push('/')} alreadyPlanned={props.dayPlanned} />
      )}
    </div>
  )
}

function Checkin({ initial, sleep, onDone, onClose }: { initial: number | null; sleep: number | null; onDone: () => void; onClose: () => void }) {
  const [energy, setEnergy] = useState<number | null>(initial)
  const [sleepH, setSleepH] = useState(sleep != null ? String(sleep) : '')
  const { pending, run } = useTaskMutation()
  const submit = () => {
    if (!energy || pending) return
    run(async () => {
      const r = await saveCheckin({ energy, sleepHours: sleepH ? Number(sleepH) : null })
      if (r.ok) onDone()
      return r
    })
  }
  useStepKeys({ onNext: submit, onBack: onClose, onPick: (i) => i < 5 && setEnergy(i + 1) })
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">How’s your energy today?</h1>
        <p className="mt-1 text-sm text-muted-foreground">No right answer. It helps explain good and bad days later.</p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setEnergy(n)}
            className={`flex flex-col items-center gap-1 rounded-2xl border-2 py-4 text-sm transition-colors ${energy === n ? 'border-primary bg-accent text-accent-foreground' : 'border-transparent bg-card shadow-soft hover:bg-muted'}`}>
            <span className="text-xl font-extrabold">{n}</span>
            <span className="text-xs font-bold text-muted-foreground">{ENERGY_LABEL[n]}</span>
          </button>
        ))}
      </div>
      <label className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">Sleep (optional)</span>
        <Input className="h-9 w-20" inputMode="decimal" value={sleepH} onChange={(e) => setSleepH(e.target.value.replace(/[^\d.]/g, ''))} placeholder="7.5" />
        <span className="text-muted-foreground">hours</span>
      </label>
      <Button size="lg" className="h-11 w-full" disabled={!energy || pending} onClick={submit}>
        {energy ? <>Continue <ArrowRight className="size-4" /><Kbd>Enter ↵</Kbd></> : 'Pick a number (1–5)'}
      </Button>
    </section>
  )
}

function Yesterday({ done, leftovers, onBack, onDone }: {
  done: number; leftovers: { id: string; title: string; deferralCount: number }[]; onBack: () => void; onDone: () => void
}) {
  const { pending, run } = useTaskMutation()
  const [handled, setHandled] = useState<Set<string>>(new Set())
  const act = (id: string, to: 'today' | 'backlog' | 'someday') =>
    run(async () => {
      const r = await moveTask({ id, to })
      if (r.ok) setHandled((h) => new Set(h).add(id))
      return r
    })
  const open = leftovers.filter((l) => !handled.has(l.id))
  useStepKeys({ onNext: onDone, onBack })
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Yesterday</h1>
        <p className="mt-1 text-muted-foreground">
          {done > 0 ? <>You finished <span className="font-medium text-foreground">{done}</span> task{done > 1 ? 's' : ''}. </> : null}
          {open.length ? 'Decide what happens to what’s left:' : 'Nothing left over.'}
        </p>
      </div>
      {open.length > 0 && (
        <ul className="divide-y rounded-2xl bg-card shadow-soft">
          {open.map((l) => (
            <li key={l.id} className={`flex flex-wrap items-center gap-2 px-3 py-2.5 ${pending ? 'opacity-60' : ''}`}>
              <span className="min-w-0 flex-1 truncate">{l.title}</span>
              {l.deferralCount >= 2 && <Chip tone="warning">put off {l.deferralCount}×</Chip>}
              <Button size="sm" onClick={() => act(l.id, 'today')}>Keep for today</Button>
              <Button size="sm" variant="ghost" onClick={() => act(l.id, 'backlog')}>Back</Button>
              <Button size="sm" variant="ghost" onClick={() => act(l.id, 'someday')}>Someday</Button>
            </li>
          ))}
        </ul>
      )}
      <Nav onBack={onBack} onNext={onDone} />
    </section>
  )
}

function Pick(props: {
  candidates: Candidate[]; projects: ProjectOption[]; wipCap: number; energy: number | null; level: GuideLevel
  today: { id: string; title: string; estimate: number | null; adjusted: number | null; evening: boolean; projectColor: string | null }[]
  onBack: () => void; onDone: () => void
}) {
  const { pending, run } = useTaskMutation()
  const [gate, setGate] = useState<Candidate | null>(null)
  const full = props.today.length >= props.wipCap
  const add = (c: Candidate) => (c.firstAction ? run(() => moveTask({ id: c.id, to: 'today' })) : setGate(c))
  useStepKeys({ onNext: props.onDone, onBack: props.onBack, enabled: !gate })
  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">What goes on Today?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fewer tasks finish more often. {props.energy && props.energy <= 2 && 'Low energy today — 2–3 tasks may be plenty.'}
        </p>
      </div>
      <div className="rounded-2xl bg-card shadow-soft">
        <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
          <span className="font-bold">Today</span>
          <span className={`tabular ${full ? 'text-warning-foreground' : 'text-muted-foreground'}`}>{props.today.length} / {props.wipCap}</span>
        </div>
        {props.today.length === 0 ? <p className="px-3 py-4 text-sm text-muted-foreground">Pick from below.</p> : (
          <ul className="divide-y">
            {props.today.map((t) => (
              <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <ProjectDot color={t.projectColor} />
                <span className="flex-1 truncate">{t.title}</span>
                {t.evening && <Moon className="size-3.5 text-muted-foreground" />}
                {t.estimate && <Chip>{t.adjusted && t.adjusted !== t.estimate ? `~${t.adjusted}m` : `${t.estimate}m`}</Chip>}
                <button className="text-muted-foreground hover:text-foreground" aria-label="Remove from today"
                  onClick={() => run(() => moveTask({ id: t.id, to: 'backlog' }))}><X className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Candidates {props.level === 'full' && '· projects behind their weekly time first'}</h2>
        {props.candidates.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No backlog or inbox items. Press <kbd className="rounded border px-1">Q</kbd> to capture something.</p>
        ) : (
          <ul className={`max-h-80 divide-y overflow-y-auto rounded-2xl bg-card shadow-soft ${pending ? 'opacity-60' : ''}`}>
            {props.candidates.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <ProjectDot color={c.projectColor} name={c.projectName} />
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                {c.behind && props.level !== 'quiet' && <Chip tone="warning">behind</Chip>}
                {c.fromInbox && <Chip>inbox</Chip>}
                {c.estimate && <Chip>{c.estimate}m</Chip>}
                <Button size="sm" variant="outline" disabled={full} onClick={() => add(c)}>Add</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {gate && (
        <PlanGateDialog task={{ id: gate.id, title: gate.title, firstAction: null, status: 'backlog', estimate: gate.estimate, energy: gate.energy, projectId: gate.projectId }}
          to="today" open onOpenChange={(o) => !o && setGate(null)} />
      )}
      <Nav onBack={props.onBack} onNext={props.onDone} nextLabel="Check the fit" />
    </section>
  )
}

function Fit({ fit, defaultAvailable, level, onBack, onDone, alreadyPlanned }: {
  fit: DayFit; defaultAvailable: number; level: GuideLevel; onBack: () => void; onDone: () => void; alreadyPlanned: boolean
}) {
  const [hours, setHours] = useState(String(Math.round((defaultAvailable / 60) * 10) / 10))
  const available = Math.round((Number(hours) || 0) * 60)
  const ratio = available ? fit.adjustedMinutes / available : Infinity
  const state = ratio <= 0.9 ? 'ok' : ratio <= 1.1 ? 'tight' : 'over'
  const { pending, run } = useTaskMutation()
  const submit = () => {
    if (pending) return
    run(async () => {
      const r = await startDay({ availableMinutes: available })
      if (r.ok) onDone()
      return r
    }, alreadyPlanned ? 'Plan updated.' : 'Day started. First up is on Home.')
  }
  useStepKeys({ onNext: submit, onBack })
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Does it fit?</h1>
        {level === 'full' && <p className="mt-1 text-sm text-muted-foreground">Estimates are adjusted by how long things actually take you.</p>}
      </div>
      <label className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">Focused hours available today</span>
        <Input className="h-9 w-20" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value.replace(/[^\d.]/g, ''))} />
      </label>
      <DayFitMeter large adjusted={fit.adjustedMinutes} available={available} raw={fit.rawMinutes} unestimated={fit.unestimated} state={state} />
      {state === 'over' && <p className="rounded-xl bg-warning-muted px-4 py-3 text-sm text-warning-foreground">Go back and move something to tomorrow — or start anyway, your call.</p>}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="size-4" /> Back<Kbd>Esc</Kbd></Button>
        <Button size="lg" className="h-11 flex-1" disabled={pending} onClick={submit}>
          <Check className="size-4" /> {alreadyPlanned ? 'Update plan' : 'Start day'}<Kbd>Enter ↵</Kbd>
        </Button>
      </div>
    </section>
  )
}

function Nav({ onBack, onNext, nextLabel = 'Continue' }: { onBack: () => void; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="flex gap-2">
      <Button variant="ghost" onClick={onBack}><ArrowLeft className="size-4" /> Back<Kbd>Esc</Kbd></Button>
      <Button size="lg" className="h-11 flex-1" onClick={onNext}>{nextLabel} <ArrowRight className="size-4" /><Kbd>Enter ↵</Kbd></Button>
    </div>
  )
}
