'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { useStepKeys } from '@/lib/client/use-step-keys'
import { startSession } from '@/app/actions/focus'
import { MODE_EMOJI, MODE_HINT, MODE_LABEL, type TimerMode } from '@/domain/focus/session'

const ORDER: TimerMode[] = ['timebox', 'ladder', 'starter', 'blind', 'free']
const TINT: Record<TimerMode, string> = { timebox: 'bg-accent', ladder: 'bg-leaf-soft', starter: 'bg-sun-soft', blind: 'bg-sky-soft', free: 'bg-muted' }

export interface SheetTask { id: string; title: string; estimate: number | null; suggestedMode: TimerMode; rung: number }

/** "How do you want to time it?" — friendly cards instead of a dropdown; the suggested one is marked. */
export function TimerSheet({ task, open, onOpenChange }: { task: SheetTask; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter()
  const [mode, setMode] = useState<TimerMode>(task.suggestedMode)
  const [minutes, setMinutes] = useState(task.estimate ?? 25)
  const [guess, setGuess] = useState('')
  const [goal, setGoal] = useState('')
  const [pending, start] = useTransition()
  const ready = !pending && !(mode === 'blind' && !Number(guess))
  const go = () =>
    ready && start(async () => {
      const r = await startSession({
        taskId: task.id, mode, suggestedMode: task.suggestedMode, goal: goal.trim() || null,
        predicted: mode === 'blind' ? Number(guess) || null : null, plannedMinutes: mode === 'timebox' ? minutes : null,
      })
      if (!r.ok) return void toast(r.error)
      onOpenChange(false)
      router.push(`/focus?task=${task.id}`)
    })
  // Enter starts; 1–5 pick a timer (while not typing). Esc closes (the dialog handles it).
  useStepKeys({ enabled: open, onNext: go, onPick: (i) => ORDER[i] && setMode(ORDER[i]) })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogTitle className="text-lg font-extrabold">How do you want to time it?</DialogTitle>
        <DialogDescription>For: {task.title}</DialogDescription>
        <div className="grid gap-2" role="radiogroup" aria-label="Timer">
          {ORDER.map((m, i) => (
            <button key={m} role="radio" title={`Press ${i + 1}`} aria-checked={mode === m} onClick={() => setMode(m)}
              className={`flex items-center gap-3 rounded-2xl border-2 p-2.5 text-left transition-colors duration-150 ${mode === m ? 'border-primary bg-accent/60' : 'border-border hover:border-primary/40'}`}>
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-xl ${TINT[m]}`}>{MODE_EMOJI[m]}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold">{MODE_LABEL[m]}{m === 'ladder' ? ` · ${task.rung} min` : ''}{m === task.suggestedMode && <span className="ml-2 rounded-full bg-sun-soft px-2 py-0.5 text-[11px] font-bold">suggested</span>}</span>
                <span className="block text-xs text-muted-foreground">{MODE_HINT[m]}</span>
              </span>
            </button>
          ))}
        </div>
        {mode === 'timebox' && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="How long">
            {[15, 25, 45, 60].map((n) => (
              <button key={n} aria-pressed={minutes === n} onClick={() => setMinutes(n)}
                className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold ${minutes === n ? 'border-primary bg-accent' : 'border-transparent bg-muted'}`}>{n === 60 ? '1 hour' : `${n} min`}</button>
            ))}
          </div>
        )}
        {mode === 'blind' && (
          <label className="block space-y-1 text-sm font-bold">
            Your guess: how many minutes will it take?
            <input autoFocus inputMode="numeric" value={guess} onChange={(e) => setGuess(e.target.value.replace(/\D/g, ''))} aria-label="Your guess in minutes"
              className="h-11 w-full rounded-xl border-2 bg-background px-3 font-semibold outline-none focus:border-primary" placeholder="e.g. 30" />
          </label>
        )}
        <label className="block space-y-1 text-sm font-bold">
          By the end I’ll have… <span className="font-semibold text-muted-foreground">(optional)</span>
          <input value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={200} placeholder="e.g. 3 pages read"
            className="h-11 w-full rounded-xl border-2 bg-background px-3 font-semibold outline-none focus:border-primary" />
        </label>
        <Button size="lg" className="w-full" disabled={!ready} onClick={go}>▶ Start<Kbd>Enter ↵</Kbd></Button>
      </DialogContent>
    </Dialog>
  )
}
