'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { completeOnboarding } from '@/app/actions/settings'
import { useStepKeys } from '@/lib/client/use-step-keys'
import { WORK_KINDS, type WorkKind } from '@/domain/setup/work-kind'

export const FOCUS_AREAS = [
  { id: 'focus', label: 'Focus', hint: 'Start faster, stay longer, get pulled away less' },
  { id: 'planning', label: 'Planning & goals', hint: 'Realistic days, weekly hours you actually keep' },
  { id: 'speaking', label: 'Speaking', hint: 'Fewer fillers, clearer answers, steadier pace' },
  { id: 'habits', label: 'Habits', hint: 'Small things, most days — without streak pressure' },
] as const
type AreaId = (typeof FOCUS_AREAS)[number]['id']

const DAILY = [30, 60, 120, 180] as const
const dailyLabel = (m: number) => (m < 60 ? `${m} min` : m === 60 ? '1 hour' : m >= 180 ? '3+ hours' : `${m / 60} hours`)

/**
 * First-run setup: four quick steps, each with a sensible answer already picked, so pressing Enter four
 * times finishes it. Number keys choose, Esc goes back. Answers only set examples, emphasis and the daily
 * target — every section stays available and everything can be changed in Settings.
 */
export function Onboarding() {
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState(0)
  const [kind, setKind] = useState<WorkKind>('exam')
  const [name, setName] = useState('')
  const [daily, setDaily] = useState<number>(60)
  const [areas, setAreas] = useState<AreaId[]>(['focus'])
  const [pending, start] = useTransition()
  const k = WORK_KINDS.find((w) => w.id === kind)!

  const finish = (skip: boolean) =>
    start(async () => {
      const r = await completeOnboarding(skip ? { focusAreas: [] } : {
        focusAreas: areas, workKind: kind, projectName: name.trim() || k.sampleName, dailyMinutes: daily,
      })
      if (!r.ok) return void toast(r.error)
      setOpen(false)
      if (!skip) toast.success('All set — add your first task below ✨')
    })

  const toggleArea = (id: AreaId) =>
    setAreas((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]))

  const next = () => {
    if (pending) return
    if (step === 3) return finish(false)
    setStep(step + 1)
  }
  useStepKeys({
    enabled: open,
    onNext: next,
    onBack: () => (step > 0 ? setStep(step - 1) : finish(true)),
    onPick: (i) => {
      if (step === 0 && WORK_KINDS[i]) setKind(WORK_KINDS[i].id)
      if (step === 2 && DAILY[i]) setDaily(DAILY[i])
      if (step === 3 && FOCUS_AREAS[i]) toggleArea(FOCUS_AREAS[i].id)
    },
  })
  if (!open) return null

  const opt = (on: boolean) =>
    `flex items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 text-left font-extrabold shadow-soft transition-colors ${on ? 'border-primary bg-accent' : 'border-transparent hover:border-border'}`
  const num = (i: number, on: boolean) => (
    <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg text-xs ${on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
  )

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="setup-title" className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/95 p-4 backdrop-blur-sm animate-rise">
      <div className="flex w-full max-w-xl flex-col gap-5">
        <div className="flex gap-1.5" aria-hidden>
          {[0, 1, 2, 3].map((i) => <i key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`} />)}
        </div>

        {step === 0 && (
          <>
            <Title q="What are you working on?" hint="Pick one — you can add more later." />
            <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="What are you working on">
              {WORK_KINDS.map((w, i) => (
                <button key={w.id} type="button" role="radio" aria-checked={kind === w.id} onClick={() => setKind(w.id)} className={opt(kind === w.id)}>
                  {num(i, kind === w.id)}<span aria-hidden>{w.emoji}</span>{w.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Title q="Give it a name" hint="Short is fine. This becomes your first project." />
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Project name"
              placeholder={k.sampleName}
              className="h-14 w-full rounded-2xl border-2 border-border bg-card px-4 text-lg font-bold outline-none focus:border-primary" />
            <p className="-mt-2 text-sm text-muted-foreground">Leave it empty and press Enter to use “{k.sampleName}”.</p>
          </>
        )}

        {step === 2 && (
          <>
            <Title q="How much time a day, roughly?" hint="A starting point for your day dial — the app learns your real pace." />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="radiogroup" aria-label="Time a day">
              {DAILY.map((m, i) => (
                <button key={m} type="button" role="radio" aria-checked={daily === m} onClick={() => setDaily(m)} className={opt(daily === m)}>
                  {num(i, daily === m)}{dailyLabel(m)}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <Title q="What do you want to get better at?" hint="Pick one to three. This only decides what we suggest first." />
            <div className="grid gap-2.5 sm:grid-cols-2" role="group" aria-label="Areas to train">
              {FOCUS_AREAS.map((a, i) => {
                const on = areas.includes(a.id)
                return (
                  <button key={a.id} type="button" aria-pressed={on} onClick={() => toggleArea(a.id)} className={`${opt(on)} items-start`}>
                    {num(i, on)}
                    <span><span className="block">{a.label}</span><span className="block text-xs font-semibold text-muted-foreground">{a.hint}</span></span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div className="flex items-center gap-3">
          {step > 0
            ? <Button variant="ghost" onClick={() => setStep(step - 1)}>← Back<Kbd>Esc</Kbd></Button>
            : <button className="text-sm font-bold text-muted-foreground hover:text-foreground" disabled={pending} onClick={() => finish(true)}>Skip for now</button>}
          <span className="text-sm text-muted-foreground">Step {step + 1} of 4</span>
          <Button className="ml-auto h-12 px-6" disabled={pending || (step === 3 && areas.length === 0)} onClick={next}>
            {step === 3 ? 'Let’s start' : 'Next'}<Kbd>Enter ↵</Kbd>
          </Button>
        </div>
      </div>
    </div>
  )
}

function Title({ q, hint }: { q: string; hint: string }) {
  return (
    <div>
      <h2 id="setup-title" className="text-2xl font-black tracking-tight sm:text-3xl">{q}</h2>
      <p className="text-muted-foreground">{hint}</p>
    </div>
  )
}
