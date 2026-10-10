'use client'

import { useTheme } from 'next-themes'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { updateEssentials } from '@/app/actions/settings'
import { useTaskMutation } from '@/components/tasks/task-actions'
import { FOCUS_AREAS } from '@/components/training/onboarding'
import { say, type Tone } from '@/domain/guide/copy'
import { WORK_KINDS } from '@/domain/setup/work-kind'

type Theme = 'system' | 'light' | 'dark'

/** The few settings most people need. Everything else is under Advanced — visible, one tap away. */
export function EssentialsSettings(props: { focusAreas: string[]; coachTone: Tone; theme: Theme; workKind: string | null; dailyMinutes: number | null }) {
  const { setTheme } = useTheme()
  const { pending, run } = useTaskMutation()
  const [areas, setAreas] = useState(props.focusAreas)
  const [tone, setTone] = useState(props.coachTone)
  const [theme, setThemeState] = useState(props.theme)
  const [kind, setKind] = useState(props.workKind ?? 'exam')
  const [daily, setDaily] = useState(String(props.dailyMinutes ?? 60))
  return (
    <section className="space-y-4 rounded-2xl bg-card shadow-soft p-5">
      <div className="space-y-2">
        <h2 className="font-bold">What you’re working on</h2>
        <p className="text-xs text-muted-foreground">Changes the examples you see.</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What you're working on">
          {WORK_KINDS.map((w) => (
            <button key={w.id} type="button" role="radio" aria-checked={kind === w.id} onClick={() => setKind(w.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors duration-150 ${kind === w.id ? 'border-primary bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
              {w.emoji} {w.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-sm">Time a day</p><p className="text-xs text-muted-foreground">The target on Today’s dial.</p></div>
        <Seg label="Time a day" value={daily} onChange={setDaily} options={[['30', '30m'], ['60', '1h'], ['120', '2h'], ['180', '3h'], ['240', '4h']]} />
      </div>
      <div className="space-y-2">
        <h2 className="font-bold">What you’re training</h2>
        <p className="text-xs text-muted-foreground">Sets what the Guide suggests first. Nothing is hidden either way.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Areas to train">
          {FOCUS_AREAS.map((a) => {
            const on = areas.includes(a.id)
            return (
              <button key={a.id} type="button" aria-pressed={on} title={a.hint}
                onClick={() => setAreas((x) => (on ? x.filter((y) => y !== a.id) : [...x, a.id]))}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors duration-150 ${on ? 'border-primary bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                {a.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-sm">Coach voice</p><p className="text-xs text-muted-foreground">“{say(tone, 'plan_day')}”</p></div>
        <Seg label="Coach voice" value={tone} onChange={(x) => setTone(x as Tone)} options={[['calm', '🌿 Calm'], ['direct', '🎯 Direct'], ['playful', '🎈 Playful']]} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">Theme</p>
        <Seg label="Theme" value={theme} onChange={(x) => { const t = x as Theme; setThemeState(t); setTheme(t) }} options={[['system', '💻 Auto'], ['light', '☀️ Light'], ['dark', '🌙 Dark']]} />
      </div>
      <div className="flex justify-end">
        <Button disabled={pending} onClick={() => run(() => updateEssentials({ focusAreas: areas as never, coachTone: tone, theme, workKind: kind as never, dailyMinutes: Number(daily) }), 'Saved.')}>Save</Button>
      </div>
    </section>
  )
}

function Seg({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex rounded-full bg-muted p-1" role="radiogroup" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)}
          className={`rounded-full px-3 py-1.5 text-sm font-bold transition-all duration-150 ${value === id ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground'}`}>{text}</button>
      ))}
    </div>
  )
}
