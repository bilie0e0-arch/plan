'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { useStepKeys } from '@/lib/client/use-step-keys'
import { workKind } from '@/domain/setup/work-kind'
import { createGoal } from '@/app/actions/goals'

type GoalType = 'outcome' | 'learning' | 'process'
const TYPES: { id: GoalType; label: string; hint: string }[] = [
  { id: 'outcome', label: 'Result', hint: 'A measurable result, mostly in your control.' },
  { id: 'learning', label: 'Learning', hint: 'A new or complex skill — judge mastery, not a score.' },
  { id: 'process', label: 'Habit', hint: 'Doing it regularly is the goal.' },
]

/**
 * WOOP activation flow (DESIGN §9.2): Wish → Outcome → Obstacle → Plan → Time.
 * One question per screen.
 */
export function GoalWizard({ projects, kind }: { projects: { id: string; name: string; color: string }[]; kind?: string | null }) {
  const router = useRouter()
  const ex = workKind(kind).goals
  const [step, setStep] = useState(0)
  const [pending, start] = useTransition()
  const [g, setG] = useState({
    title: '', type: 'outcome' as GoalType, targetText: '', targetValue: '', targetUnit: '', deadline: '',
    why: '', obstacle: '', ifThen: '', weeklyHours: '4', projectIds: [] as string[],
    milestones: [] as { title: string; dueDate: string }[],
  })
  const set = <K extends keyof typeof g>(k: K, v: (typeof g)[K]) => setG((x) => ({ ...x, [k]: v }))
  const steps = ['Wish', 'Outcome', 'Obstacle', 'Plan', 'Time']
  const canNext = [
    g.title.trim().length > 0,
    g.targetText.trim().length > 0 && (g.type === 'process' || !!g.deadline),
    g.obstacle.trim().length >= 3,
    g.ifThen.trim().length >= 3,
    true,
  ][step]

  const save = (activate: boolean) =>
    start(async () => {
      const r = await createGoal({
        title: g.title, type: g.type, targetText: g.targetText,
        targetValue: g.targetValue ? Number(g.targetValue) : null, targetUnit: g.targetUnit || null,
        deadline: g.type === 'process' ? null : g.deadline || null, weeklyHours: Number(g.weeklyHours) || 0,
        why: g.why || null, obstacle: g.obstacle, ifThen: g.ifThen, projectIds: g.projectIds,
        milestones: g.milestones.filter((m) => m.title.trim()).map((m) => ({ title: m.title, dueDate: m.dueDate || null })),
        activate,
      })
      if (!r.ok) return void toast(r.error)
      toast.success(activate ? 'Goal active. Place its hours on your week.' : 'Saved as draft.')
      router.push(activate ? '/calendar' : `/goals/${r.id}`)
    })
  // Enter continues (activates on the last step), Esc goes back, 1–3 pick the goal type on the first step.
  useStepKeys({
    onNext: () => (step < 4 ? canNext && setStep(step + 1) : save(true)),
    onBack: () => (step > 0 ? setStep(step - 1) : router.push('/goals')),
    onPick: (i) => step === 0 && TYPES[i] && set('type', TYPES[i].id),
  })

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/goals" className="text-sm text-muted-foreground hover:text-foreground"><X className="inline size-4" /> Close<Kbd>Esc</Kbd></Link>
        <div className="flex gap-1.5">{steps.map((s, i) => <span key={s} title={s} className={`h-1.5 w-6 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />)}</div>
        <span className="w-12 text-right text-xs text-muted-foreground">{steps[step]}</span>
      </div>

      {step === 0 && (
        <Q title="What do you want?" sub="Name it plainly.">
          <Input autoFocus aria-label="Goal" value={g.title} onChange={(e) => set('title', e.target.value)} placeholder={ex[g.type]} className="h-11 text-base" />
          <div className="grid gap-2 sm:grid-cols-3">
            {TYPES.map((t, i) => (
              <button key={t.id} onClick={() => set('type', t.id)} title={`Press ${i + 1}`}
                className={`rounded-xl border p-3 text-left text-sm ${g.type === t.id ? 'border-primary bg-accent' : 'hover:bg-muted'}`}>
                <span className="font-bold">{t.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{t.hint}</span>
                <span className="mt-1 block text-xs italic text-muted-foreground">e.g. {ex[t.id]}</span>
              </button>
            ))}
          </div>
        </Q>
      )}
      {step === 1 && (
        <Q title="What does done look like?" sub="Specific beats inspiring. Add why it matters — you’ll see it when you fall behind.">
          <Input autoFocus aria-label="Done looks like" value={g.targetText} onChange={(e) => set('targetText', e.target.value)} placeholder={g.type === 'process' ? ex.process : g.type === 'learning' ? ex.learning : ex.outcome} />
          {g.type !== 'process' && (
            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1 text-xs text-muted-foreground">Target number (optional)<Input inputMode="decimal" value={g.targetValue} onChange={(e) => set('targetValue', e.target.value.replace(/[^\d.]/g, ''))} placeholder="80" /></label>
              <label className="space-y-1 text-xs text-muted-foreground">Unit<Input value={g.targetUnit} onChange={(e) => set('targetUnit', e.target.value)} placeholder="%" /></label>
              <label className="space-y-1 text-xs text-muted-foreground">Deadline<Input type="date" value={g.deadline} onChange={(e) => set('deadline', e.target.value)} /></label>
            </div>
          )}
          <Input value={g.why} onChange={(e) => set('why', e.target.value)} placeholder="Why it matters (one line)" />
        </Q>
      )}
      {step === 2 && (
        <Q title="What inside you is most likely to stop you?" sub="Not circumstances — your own habit, feeling or pattern. Naming it is what makes the plan work.">
          <Input autoFocus aria-label="Obstacle" value={g.obstacle} onChange={(e) => set('obstacle', e.target.value)} placeholder="I put it off when I’m tired" className="h-11" />
        </Q>
      )}
      {step === 3 && (
        <Q title="If that happens, then what will you do?" sub="A small, concrete response you can do even on a bad day.">
          <Input autoFocus aria-label="If-then plan" value={g.ifThen} onChange={(e) => set('ifThen', e.target.value)} placeholder="If I’m tired, then I do just 5 minutes" className="h-11" />
          {g.obstacle && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Obstacle: {g.obstacle}</p>}
        </Q>
      )}
      {step === 4 && (
        <Q title="How much time will you give it each week?" sub="Promise what you’ll actually keep. You can raise it after two kept weeks.">
          <label className="flex items-center gap-2 text-sm">
            <Input className="h-11 w-24 text-base" inputMode="decimal" value={g.weeklyHours} onChange={(e) => set('weeklyHours', e.target.value.replace(/[^\d.]/g, ''))} />
            hours / week
          </label>
          {projects.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Which projects count toward it?</p>
              <div className="flex flex-wrap gap-1.5">
                {projects.map((p) => {
                  const on = g.projectIds.includes(p.id)
                  return (
                    <button key={p.id} onClick={() => set('projectIds', on ? g.projectIds.filter((x) => x !== p.id) : [...g.projectIds, p.id])}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm ${on ? 'border-primary bg-accent' : ''}`}>
                      <span className="size-2 rounded-full" style={{ background: `var(--project-${p.color})` }} />{p.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Milestones (2–6 keep a finish line close)</p>
            {g.milestones.map((m, i) => (
              <div key={i} className="flex gap-2">
                <Input data-no-step-keys value={m.title} onChange={(e) => set('milestones', g.milestones.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} placeholder={`Milestone ${i + 1}`} />
                <Input type="date" className="w-40" value={m.dueDate} onChange={(e) => set('milestones', g.milestones.map((x, k) => (k === i ? { ...x, dueDate: e.target.value } : x)))} />
                <button aria-label="Remove milestone" onClick={() => set('milestones', g.milestones.filter((_, k) => k !== i))}><X className="size-4 text-muted-foreground" /></button>
              </div>
            ))}
            {g.milestones.length < 6 && (
              <button className="flex items-center gap-1 text-sm text-primary" onClick={() => set('milestones', [...g.milestones, { title: '', dueDate: '' }])}>
                <Plus className="size-3.5" /> Add milestone
              </button>
            )}
          </div>
        </Q>
      )}

      <div className="flex gap-2">
        {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="size-4" /> Back<Kbd>Esc</Kbd></Button>}
        {step < 4 ? (
          <Button size="lg" className="h-11 flex-1" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue <ArrowRight className="size-4" /><Kbd>Enter ↵</Kbd></Button>
        ) : (
          <>
            <Button variant="outline" size="lg" className="h-11" disabled={pending} onClick={() => save(false)}>Save draft</Button>
            <Button size="lg" className="h-11 flex-1" disabled={pending} onClick={() => save(true)}>Activate goal<Kbd>Enter ↵</Kbd></Button>
          </>
        )}
      </div>
    </div>
  )
}

function Q({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      </div>
      {children}
    </section>
  )
}
