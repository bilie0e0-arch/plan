'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, Lock, Minus, Stamp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { useStepKeys } from '@/lib/client/use-step-keys'
import { Input } from '@/components/ui/input'
import { closeReview, gradeOutcome, saveOutcomes, setConfidence, setMission, setReviewStep } from '@/app/actions/training'
import { setWeeklyCommitment } from '@/app/actions/goals'
import { useTaskMutation } from '@/components/tasks/task-actions'
import { WeekWrapped } from './week-wrapped'
import { AgingQueue } from './aging-queue'
import { MISSIONS } from '@/domain/training/missions'
import { CAPACITY_RATIO } from '@/domain/calendar/blocks'
import type { SkillId } from '@/domain/skills/skills'
import type { ReviewData } from '@/lib/data/review'
import { fmtMinutes } from '@/lib/format'

const STEPS = ['Week Wrapped', 'Outcomes', 'Goals', 'Mission result', 'Skills & mission', 'Clean up', 'Commitments', 'Plan', 'Lock in my week'] as const
const BAND: Record<string, string> = { developing: 'Developing', competent: 'Competent', strong: 'Strong' }
const fmtWeek = (k: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${k}T00:00:00Z`))

/** Weekly Review & Planning, one combined flow (DESIGN §13.12). */
export function ReviewFlow({ d }: { d: ReviewData }) {
  const router = useRouter()
  const [step, setStep] = useState(d.closed ? 9 : Math.min(9, Math.max(1, d.step)))
  const [, startSave] = useTransition()
  const go = (n: number) => {
    const s = Math.min(9, Math.max(1, n))
    setStep(s)
    window.scrollTo({ top: 0 })
    if (!d.closed) startSave(() => void setReviewStep(d.planWeek, s))
  }
  // Enter = next step (fields keep their own Enter), Esc = previous step. The last step handles its own Enter.
  useStepKeys({ onNext: step < 9 ? () => go(step + 1) : undefined, onBack: () => (step > 1 ? go(step - 1) : router.push('/')), enterInFields: false })

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Weekly review</h1>
          <p className="text-sm text-muted-foreground">Looking back at {fmtWeek(d.reviewedWeek)} · planning the week of {fmtWeek(d.planWeek)}</p>
        </div>
        <ol className="flex gap-1" aria-label="Review steps">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1">
              <button onClick={() => go(i + 1)} aria-current={step === i + 1 ? 'step' : undefined} aria-label={`Step ${i + 1}: ${label}`} title={label}
                className={`h-1.5 w-full rounded-full transition-colors ${i + 1 < step ? 'bg-primary/60' : i + 1 === step ? 'bg-primary' : 'bg-muted'}`} />
            </li>
          ))}
        </ol>
        <p className="text-sm font-medium">{step}. {STEPS[step - 1]}</p>
      </header>

      {step === 1 && (d.cards.length ? <WeekWrapped cards={d.cards} onDone={() => go(2)} /> : null)}
      {step === 2 && <Outcomes d={d} />}
      {step === 3 && <Goals d={d} />}
      {step === 4 && <MissionResult d={d} />}
      {step === 5 && <ChooseMission d={d} />}
      {step === 6 && <AgingQueue tasks={d.aging} />}
      {step === 7 && <Commitments d={d} />}
      {step === 8 && <Plan d={d} />}
      {step === 9 && <Commit d={d} onDone={() => router.push('/')} />}

      {step !== 1 && (
        <nav className="flex justify-between border-t pt-4">
          <Button variant="ghost" onClick={() => go(step - 1)}><ArrowLeft className="size-4" /> Back<Kbd>Esc</Kbd></Button>
          {step < 9 && <Button onClick={() => go(step + 1)}>{step === 6 && d.aging.length ? 'Skip for now' : 'Next'} <ArrowRight className="size-4" /><Kbd>Enter ↵</Kbd></Button>}
        </nav>
      )}
    </div>
  )
}

function Outcomes({ d }: { d: ReviewData }) {
  const { pending, run } = useTaskMutation()
  const [texts, setTexts] = useState(d.planOutcomes)
  const dirty = texts.some((t, i) => t !== d.planOutcomes[i])
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-bold">Last week’s outcomes</h2>
        {d.gradeOutcomes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No outcomes were set for last week. That starts now.</p>
        ) : (
          <ul className="divide-y rounded-2xl bg-card shadow-soft">
            {d.gradeOutcomes.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <span className="min-w-0 flex-1">{o.text}</span>
                <div className="flex gap-1" role="group" aria-label={`Grade: ${o.text}`}>
                  {(['met', 'partial', 'missed'] as const).map((g) => (
                    <button key={g} disabled={pending} onClick={() => run(() => gradeOutcome(o.id, g))} aria-pressed={o.result === g}
                      className={`rounded-md border px-2.5 py-1 text-xs capitalize ${o.result === g ? 'border-primary bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{g}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <div>
          <h2 className="font-bold">This week’s 3 outcomes</h2>
          <p className="text-sm text-muted-foreground">Results, not activities — “Chapter 3 drafted”, not “work on the book”.</p>
        </div>
        {texts.map((t, i) => (
          <Input key={i} aria-label={`Outcome ${i + 1}`} value={t} maxLength={200} placeholder={['e.g. Chapter 5 done, flashcards made', 'Second outcome', 'Third outcome'][i]}
            onChange={(e) => setTexts((xs) => xs.map((x, k) => (k === i ? e.target.value : x)))} />
        ))}
        <Button variant="outline" disabled={pending || !dirty} onClick={() => run(() => saveOutcomes(d.planWeek, texts), 'Outcomes saved.')}>Save outcomes</Button>
      </section>
    </div>
  )
}

function Goals({ d }: { d: ReviewData }) {
  const [conf, setConf] = useState<Record<string, number>>(() => Object.fromEntries(d.goals.map((g) => [g.id, g.confidence ?? 70])))
  const [saved, setSaved] = useState<Set<string>>(() => new Set(d.goals.filter((g) => g.confidence !== null).map((g) => g.id)))
  const [, start] = useTransition()
  if (!d.goals.length) return <p className="text-sm text-muted-foreground">No active goals. <Link href="/goals/new" className="text-primary hover:underline">Create one</Link> when you’re ready.</p>
  return (
    <ul className="space-y-3">
      {d.goals.map((g) => {
        const lw = g.lastWeek
        const pct = lw && lw.committed ? Math.round((lw.actual / lw.committed) * 100) : null
        return (
          <li key={g.id} className="space-y-3 rounded-2xl bg-card shadow-soft p-4">
            <div className="flex items-baseline justify-between gap-2">
              <Link href={`/goals/${g.id}`} className="font-medium hover:underline">{g.title}</Link>
              <span className="text-xs text-muted-foreground">{g.pace}</span>
            </div>
            <p className="text-sm text-muted-foreground tabular">
              {lw ? <>{lw.complete ? 'Last week' : 'This week so far'}: committed {fmtMinutes(lw.committed)} · actual {fmtMinutes(lw.actual)} ({pct}%){lw.confidence !== null && ` · you forecast ${lw.confidence}%`}</> : 'No completed week yet.'}
            </p>
            <label className="block space-y-1">
              <span className="text-sm">How likely are you to deliver this week’s {fmtMinutes(g.weeklyMinutes)}? <b className="tabular">{conf[g.id]}%</b></span>
              <input type="range" min={0} max={100} step={5} value={conf[g.id]} aria-label={`Confidence for ${g.title}`}
                onChange={(e) => setConf((c) => ({ ...c, [g.id]: Number(e.target.value) }))}
                onPointerUp={() => start(async () => { const r = await setConfidence(g.id, d.planWeek, conf[g.id]!); if (r.ok) setSaved((s) => new Set(s).add(g.id)) })}
                onKeyUp={() => start(async () => { const r = await setConfidence(g.id, d.planWeek, conf[g.id]!); if (r.ok) setSaved((s) => new Set(s).add(g.id)) })}
                className="w-full accent-[var(--primary)]" />
              <span className="text-xs text-muted-foreground">{saved.has(g.id) ? 'Forecast saved — scored against what you deliver.' : 'Move the slider to record a forecast.'}</span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

function MissionResult({ d }: { d: ReviewData }) {
  if (!d.pastMissions.length) return <p className="text-sm text-muted-foreground">No mission last week. Pick your first one in the next step.</p>
  return (
    <ul className="space-y-3">
      {d.pastMissions.map((m) => {
        const now = d.skills.find((s) => s.id === m.skill)
        return (
          <li key={m.id} className="space-y-2 rounded-2xl bg-card shadow-soft p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{m.kind === 'main' ? 'Main mission' : 'Side mission'}</p>
              {m.done && <span className="flex animate-settle items-center gap-1 rounded-full bg-success-muted px-2 py-0.5 text-xs font-medium"><Stamp className="size-3.5" /> Complete</span>}
            </div>
            <p className="font-bold">{m.title}</p>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }} /></div>
            <p className="text-sm text-muted-foreground tabular">{m.progress} / {m.target} {m.unit}</p>
            <p className="text-sm tabular">
              {now?.name}: {m.resultBefore === null ? '—' : m.resultBefore} → {now?.display ?? '—'}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

function ChooseMission({ d }: { d: ReviewData }) {
  const { pending, run } = useTaskMutation()
  const main = d.planMissions.find((m) => m.kind === 'main')
  const side = d.planMissions.find((m) => m.kind === 'side')
  const choose = (kind: 'main' | 'side', skill: SkillId | null) => run(() => setMission(d.planWeek, kind, skill), skill ? 'Mission set.' : 'Side mission cleared.')
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">One main mission — the skill you’ll drill this week. Suggested: <b>{d.skills.find((s) => s.id === d.suggested)?.name}</b> (weakest trend). Optional side mission.</p>
      <ul className={`divide-y rounded-2xl bg-card shadow-soft ${pending ? 'opacity-70' : ''}`}>
        {d.skills.map((s) => {
          const Trend = s.trend === 'better' ? ArrowUpRight : s.trend === 'worse' ? ArrowDownRight : Minus
          const isMain = main?.skill === s.id, isSide = side?.skill === s.id
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <div className="min-w-40 flex-1">
                <p className="font-bold">{s.name}{s.id === d.suggested && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">suggested</span>}</p>
                <p className="text-xs text-muted-foreground">{MISSIONS[s.id].title}</p>
              </div>
              <span className="text-xs text-muted-foreground">{s.band ? BAND[s.band] : 'Calibrating'}</span>
              <span className="w-24 text-right text-sm tabular">{s.display}</span>
              {s.trend ? <Trend className="size-3.5 text-muted-foreground" aria-label={s.trend} /> : <span className="size-3.5" />}
              <div className="flex gap-1">
                <Button size="sm" variant={isMain ? 'secondary' : 'outline'} disabled={pending} aria-pressed={isMain} onClick={() => choose('main', s.id)}>{isMain ? <><Check className="size-3.5" /> Main</> : 'Main'}</Button>
                <Button size="sm" variant={isSide ? 'secondary' : 'ghost'} disabled={pending || isMain} aria-pressed={isSide} onClick={() => choose('side', isSide ? null : s.id)}>Side</Button>
              </div>
            </li>
          )
        })}
      </ul>
      {main && <p className="text-sm">This week: <b>{main.title}</b>. Trainer: {MISSIONS[main.skill].trainer.toLowerCase()}.</p>}
    </div>
  )
}

function Commitments({ d }: { d: ReviewData }) {
  const { pending, run } = useTaskMutation()
  const withNotes = d.goals.filter((g) => g.suggestion || g.paceNote)
  if (!d.goals.length) return <p className="text-sm text-muted-foreground">No active goals to calibrate.</p>
  return (
    <div className="space-y-3">
      {withNotes.length === 0 && <p className="text-sm text-muted-foreground">No changes suggested — your commitments match what you deliver.</p>}
      {withNotes.map((g) => (
        <div key={g.id} className="space-y-2 rounded-2xl bg-card shadow-soft p-4">
          <p className="font-bold">{g.title} <span className="text-sm font-normal text-muted-foreground">· {fmtMinutes(g.weeklyMinutes)}/week now</span></p>
          {g.suggestion && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-sm">{g.suggestion.text}</p>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setWeeklyCommitment(g.id, g.suggestion!.minutes / 60), `Now ${fmtMinutes(g.suggestion!.minutes)}/week.`)}>
                Commit to {fmtMinutes(g.suggestion.minutes)}
              </Button>
            </div>
          )}
          {g.paceNote && <p className="text-sm text-muted-foreground">{g.paceNote}</p>}
          {g.history.length > 0 && (
            <div className="flex items-end gap-1 pt-1" aria-label="Committed vs actual, last weeks">
              {g.history.map((w) => (
                <div key={w.week} className="flex flex-1 flex-col items-center gap-0.5" title={`${fmtWeek(w.week)}: ${fmtMinutes(w.actual)} of ${fmtMinutes(w.committed)}`}>
                  <div className="relative h-10 w-full rounded bg-muted">
                    <div className="absolute inset-x-0 bottom-0 rounded bg-primary/70" style={{ height: `${Math.min(100, w.committed ? (w.actual / w.committed) * 100 : 0)}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{fmtWeek(w.week)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Plan({ d }: { d: ReviewData }) {
  const cap = d.plan.freeMinutes ? d.plan.plannedMinutes / d.plan.freeMinutes : 0
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex justify-between text-sm tabular">
          <span>Planned {fmtMinutes(d.plan.plannedMinutes)} of {fmtMinutes(d.plan.freeMinutes)} free</span>
          <span className={cap > CAPACITY_RATIO ? 'text-warning-foreground' : 'text-muted-foreground'}>{Math.round(cap * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${cap > CAPACITY_RATIO ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${Math.min(100, cap * 100)}%` }} /></div>
        {cap > CAPACITY_RATIO && <p className="text-xs text-muted-foreground">Over {Math.round(CAPACITY_RATIO * 100)}% of free time. Leave room for real life — or expect to release blocks.</p>}
      </div>
      <ul className="divide-y rounded-2xl bg-card shadow-soft">
        {d.goals.map((g) => (
          <li key={g.id} className="flex justify-between px-3 py-2 text-sm">
            <span>{g.title}</span>
            <span className={`tabular ${g.plannedMinutes < g.weeklyMinutes ? 'text-muted-foreground' : ''}`}>{fmtMinutes(g.plannedMinutes)} / {fmtMinutes(g.weeklyMinutes)} placed</span>
          </li>
        ))}
        {d.goals.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No goals — place tasks or rituals as blocks if you like.</li>}
      </ul>
      <Link href={`/calendar?week=${d.planWeek}&from=review`} className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-muted">
        <CalendarDays className="size-4" /> Open the week planner
      </Link>
    </div>
  )
}

function Commit({ d, onDone }: { d: ReviewData; onDone: () => void }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(d.closed ? 'Week locked in.' : null)
  const lock = () => {
    if (pending) return
    start(async () => {
      const r = await closeReview(d.planWeek)
      if (!r.ok) return void toast(r.error)
      setMsg(r.firstBlock ? `Week locked in. First block: ${r.firstBlock}.` : 'Week locked in.')
    })
  }
  useStepKeys({ onNext: msg ? onDone : lock })
  return (
    <div className="space-y-4 py-6 text-center">
      {msg ? (
        <>
          <Lock className="mx-auto size-8 animate-settle text-primary" />
          <p className="text-xl font-semibold">{msg}</p>
          <p className="text-sm text-muted-foreground">Your original plan is on record. Next week’s review starts with how it went.</p>
          <Button onClick={onDone}>Go to Home<Kbd>Enter ↵</Kbd></Button>
        </>
      ) : (
        <>
          <p className="text-lg font-extrabold">Lock in this plan?</p>
          <p className="text-sm text-muted-foreground">{d.plan.blockCount} block{d.plan.blockCount === 1 ? '' : 's'} planned. You can still move or release blocks — changes are recorded, the original stays.</p>
          <Button size="lg" className="h-11" disabled={pending} onClick={lock}>
            <Lock className="size-4" /> Lock in my week<Kbd>Enter ↵</Kbd>
          </Button>
        </>
      )}
    </div>
  )
}
