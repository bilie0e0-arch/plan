'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Pause, Play, Shield, Square, Volume2, VolumeX, X } from 'lucide-react'
import { CaptureDialog } from '@/components/capture/capture-dialog'
import { FocusGauge } from './focus-gauge'
import {
  extendStarter, logDistraction, pauseSession, respondStepDown, resumeSession, reviewSession, startSession, stopSession,
  type StopResult,
} from '@/app/actions/focus'
import { MODE_EMOJI, MODE_LABEL, plannedMinutesFor, type TimerMode } from '@/domain/focus/session'
import { say, type Tone } from '@/domain/guide/copy'
import type { GuideLevel } from '@/domain/skills/skills'
import { fmtClock, useElapsed } from '@/lib/client/use-elapsed'
import { keyInfo, plainKey } from '@/lib/hotkeys'
import { chime } from '@/lib/client/chime'
import { noisePreferred, setNoisePreferred, startNoise, stopNoise } from '@/lib/client/noise'
import { beat } from '@/lib/client/partner-feed'

export interface FocusTask {
  id: string; title: string; firstAction: string | null; reentryNote: string | null
  estimate: number | null; suggestedMode: TimerMode; why: string | null
}
export interface RunningSession {
  id: string; mode: TimerMode; startedAt: string; pausedAt: string | null; pausedSeconds: number
  plannedMinutes: number | null; goal: string | null; predicted: number | null; distractions: number
}

type Phase = 'before' | 'countdown' | 'running' | 'after'

interface StartConfig { mode: TimerMode; goal: string | null; predicted: number | null; suggestedMode: TimerMode | null; blockId?: string | null; plannedMinutes?: number | null }

export interface Autostart { blockId: string; mode: TimerMode; plannedMinutes: number; goal: string | null }
/** "Run my Today list": position in the list and the task that follows (DESIGN: fewer decisions between tasks). */
export interface RunInfo { position: number; total: number; next: { id: string; title: string } | null }

export function FocusMode(props: {
  task: FocusTask; running: RunningSession | null; rung: number; cleanCount: number; suggestDown: boolean
  timerLevel: GuideLevel; goalLevel: GuideLevel; tone: Tone; sound: boolean; autostart?: Autostart | null; goalRequired?: boolean
  run?: RunInfo | null; finishNow?: boolean
}) {
  const router = useRouter()
  const a = props.autostart
  // Launched from a block: skip "before" — the launcher already did setup and the goal.
  const [phase, setPhase] = useState<Phase>(props.running ? 'running' : a ? 'countdown' : 'before')
  const [session, setSession] = useState<RunningSession | null>(props.running)
  const [config, setConfig] = useState<StartConfig | null>(a ? {
    mode: a.mode, goal: a.goal, predicted: null, suggestedMode: null, blockId: a.blockId, plannedMinutes: a.plannedMinutes,
  } : null)
  const [result, setResult] = useState<StopResult | null>(null)

  // The session is created after the 3-2-1 countdown so measured time starts when work starts.
  const launch = useCallback(async () => {
    if (!config) return
    const r = await startSession({ taskId: props.task.id, ...config })
    if (!r.ok) {
      toast(r.error)
      setPhase('before')
      return
    }
    setSession({
      id: r.id, mode: config.mode, startedAt: r.startedAt, pausedAt: null, pausedSeconds: 0,
      plannedMinutes: r.plannedMinutes, goal: config.goal, predicted: config.predicted, distractions: 0,
    })
    setPhase('running')
    router.refresh()
  }, [config, props.task.id, router])

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-2xl flex-col px-6 py-6">
      {phase === 'before' && <Before {...props} onStart={(c) => { setConfig(c); setPhase('countdown') }} />}
      {phase === 'countdown' && <Countdown onDone={launch} />}
      {phase === 'running' && session && (
        <Running task={props.task} session={session} setSession={setSession} sound={props.sound} finishNow={!!props.finishNow}
          onStopped={(r) => { setResult(r); setPhase('after') }} />
      )}
      {phase === 'after' && session && result && (
        <After task={props.task} session={session} result={result} tone={props.tone} goalLevel={props.goalLevel} run={props.run ?? null} />
      )}
    </main>
  )
}

/** A focused button or link that handles its own Enter/Space (choice buttons don't — Enter moves on). */
function actionButton(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return !!target.closest('button, a') && !target.closest('[role="radio"], [aria-pressed]')
}

// ───────────── Before: session protocol step 1 ─────────────

function Before({ task, rung, cleanCount, suggestDown, timerLevel, goalLevel, tone, goalRequired, run, onStart }: {
  task: FocusTask; rung: number; cleanCount: number; suggestDown: boolean; timerLevel: GuideLevel; goalLevel: GuideLevel; tone: Tone; goalRequired?: boolean
  run?: RunInfo | null
  onStart: (c: StartConfig) => void
}) {
  const router = useRouter()
  // Fading: Developing → mode preselected; Competent → shown, not preselected; Strong → not shown.
  const [mode, setMode] = useState<TimerMode | null>(timerLevel === 'full' ? task.suggestedMode : timerLevel === 'quiet' ? 'free' : null)
  const [goal, setGoal] = useState('')
  const [predicted, setPredicted] = useState('')
  const [, start] = useTransition()
  const [down, setDown] = useState(suggestDown)
  const planned = mode ? plannedMinutesFor(mode, rung, task.estimate) : null
  const modes: TimerMode[] = ['ladder', 'blind', 'starter', 'timebox', 'free']

  const canStart = !!mode && !(mode === 'blind' && !Number(predicted)) && !(goalRequired && !goal.trim())
  const begin = () => {
    if (!mode || !canStart) return
    onStart({
      mode, goal: goal.trim() || null,
      predicted: mode === 'blind' ? Number(predicted) || null : null,
      suggestedMode: timerLevel === 'quiet' ? null : task.suggestedMode,
    })
  }

  // Enter starts (also from the goal/guess fields); 1–5 pick a timer; Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = keyInfo(e)
      if (k.ctrlKey || k.metaKey || k.altKey) return
      const onButton = actionButton(e.target)
      if (e.key === 'Enter' && !onButton) { e.preventDefault(); begin() }
      else if (e.key === 'Escape' && !k.typing) router.push('/')
      else if (!k.typing && /^[1-5]$/.test(e.key) && timerLevel !== 'quiet') setMode(modes[Number(e.key) - 1]!)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between text-sm text-white/50">
        <Link href="/" className="hover:text-white"><X className="inline size-4" /> Close <kbd className="text-white/30">Esc</kbd></Link>
        <span>{run ? `Running your list · ${run.position} of ${run.total}` : `Ladder ${rung} · ${cleanCount}/3 clean`}</span>
      </div>
      <div className="my-auto space-y-8 py-10">
        {task.reentryNote && <p className="text-center text-sm text-white/60">Last time: {task.reentryNote}</p>}
        <h1 className="text-center text-3xl font-semibold leading-tight">{task.firstAction || task.title}</h1>

        {down && (
          <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm">
            <p>{say(tone, 'suggest_down', { rung: rung > 15 ? [15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 90].filter((r) => r < rung).at(-1)! : 15 })}</p>
            <div className="mt-3 flex gap-2">
              <button className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20" onClick={() => start(async () => { await respondStepDown(true); setDown(false); router.refresh() })}>Yes, step down</button>
              <button className="rounded-lg px-3 py-1.5 text-white/60 hover:text-white" onClick={() => start(async () => { await respondStepDown(false); setDown(false) })}>Keep {rung}</button>
            </div>
          </div>
        )}

        {timerLevel !== 'quiet' && (
          <div className="space-y-2">
            <p className="text-center text-xs uppercase tracking-wide text-white/40">
              {timerLevel === 'full' ? `Suggested: ${MODE_EMOJI[task.suggestedMode]} ${MODE_LABEL[task.suggestedMode]}` : 'How do you want to time it?'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {modes.map((m, i) => (
                <button key={m} onClick={() => setMode(m)} title={`Press ${i + 1}`} aria-pressed={mode === m}
                  className={`rounded-full border-2 px-3.5 py-1.5 text-sm font-bold transition-colors ${mode === m ? 'border-teal-300 bg-teal-300/15 text-teal-100' : 'border-white/10 text-white/70 hover:bg-white/5'}`}>
                  {MODE_EMOJI[m]} {MODE_LABEL[m]}{m === 'ladder' ? ` · ${rung}m` : m === 'timebox' ? ` · ${task.estimate ?? 25}m` : ''}
                </button>
              ))}
            </div>
            {timerLevel === 'full' && task.why && <p className="text-center text-xs text-white/40">{task.why}</p>}
          </div>
        )}

        <div className="mx-auto w-full max-w-md space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-bold text-white/60">By the end I’ll have… {goalRequired ? '(this week’s mission: please add one)' : '(optional)'}</span>
            <input value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={200}
              placeholder={goalLevel === 'full' ? 'e.g. summary notes + 10 flashcards' : ''}
              className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 outline-none focus:border-teal-300/60" />
          </label>
          {mode === 'blind' && (
            <label className="block space-y-1">
              <span className="text-sm font-bold text-white/60">Your guess: how many minutes? The clock stays hidden.</span>
              <input value={predicted} inputMode="numeric" onChange={(e) => setPredicted(e.target.value.replace(/\D/g, ''))}
                className="h-11 w-32 rounded-xl border border-white/15 bg-white/5 px-3 outline-none focus:border-teal-300/60" />
            </label>
          )}
        </div>
      </div>
      <button disabled={!canStart} onClick={begin}
        className="mx-auto h-12 w-full max-w-md rounded-xl bg-teal-300 font-bold text-[oklch(0.2_0.02_185)] transition-opacity disabled:opacity-40">
        {mode ? <>▶ Start{planned ? ` · ${planned} min` : ''} <kbd className="ml-1 rounded border border-current/40 px-1.5 text-[11px] opacity-60">Enter ↵</kbd></> : 'Pick how to time it (1–5)'}
      </button>
    </div>
  )
}

function Countdown({ onDone }: { onDone: () => void | Promise<void> }) {
  const [n, setN] = useState(3)
  useEffect(() => {
    if (n === 0) {
      void onDone()
      return
    }
    const t = setTimeout(() => setN(n - 1), 1000)
    return () => clearTimeout(t)
  }, [n, onDone])
  return <div className="flex flex-1 items-center justify-center"><span key={n} className="animate-settle text-8xl font-light tabular">{n || ''}</span></div>
}

// ───────────── Running ─────────────

function Running({ task, session, setSession, sound, finishNow, onStopped }: {
  task: FocusTask; session: RunningSession; setSession: (s: RunningSession) => void; sound: boolean; finishNow: boolean
  onStopped: (r: StopResult) => void
}) {
  const elapsed = useElapsed(session.startedAt, session.pausedAt, session.pausedSeconds)
  const [parking, setParking] = useState(false)
  const [distractMode, setDistractMode] = useState(false)
  const [distractions, setDistractions] = useState(session.distractions)
  const [pending, start] = useTransition()
  const chimed = useRef(false)
  const autoStopped = useRef(false)
  // Phone guard: leaving this screen is a pull when the timer runs on your phone. On a computer you often work
  // in another tab, so it starts off there (and can be switched on).
  const [guard, setGuard] = useState(false)
  const [away, setAway] = useState<number | null>(null)
  const leftAt = useRef<number | null>(null)
  const [noise, setNoise] = useState(false)
  useEffect(() => {
    // Browser-only preferences, read once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGuard(window.matchMedia('(pointer: coarse)').matches)
    if (noisePreferred()) { setNoise(true); startNoise() }
    return () => stopNoise()
  }, [])
  useEffect(() => {
    if (!guard) return
    const onVis = () => {
      if (document.hidden) leftAt.current = Date.now()
      else if (leftAt.current) {
        const secs = Math.round((Date.now() - leftAt.current) / 1000)
        leftAt.current = null
        if (secs >= 15 && !session.pausedAt) setAway(secs)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [guard, session.pausedAt])
  // Partner presence: in focus until the planned end (or just "in focus" for open-ended sessions).
  useEffect(() => {
    const until = session.plannedMinutes ? new Date(new Date(session.startedAt).getTime() + (session.plannedMinutes * 60 + session.pausedSeconds) * 1000).toISOString() : null
    void beat(session.pausedAt ? 'online' : 'focus', until)
    const t = setInterval(() => void beat(session.pausedAt ? 'online' : 'focus', until), 30_000)
    return () => { clearInterval(t); void beat('online') }
  }, [session.startedAt, session.plannedMinutes, session.pausedSeconds, session.pausedAt])
  const toggleNoise = () => {
    const on = !noise
    setNoise(on)
    setNoisePreferred(on)
    if (on) startNoise()
    else stopNoise()
  }

  const blind = session.mode === 'blind'
  const plannedSec = session.plannedMinutes ? session.plannedMinutes * 60 : null
  const remaining = plannedSec !== null ? plannedSec - elapsed : null
  const overTime = remaining !== null && remaining <= 0
  const starterCheck = session.mode === 'starter' && session.plannedMinutes !== null && overTime
  const wrapUp = session.mode === 'timebox' && remaining !== null && remaining <= 120

  const stop = useCallback((discarded: boolean) =>
    start(async () => {
      const r = await stopSession({ id: session.id, discarded })
      if (!r.ok) return void toast(r.error)
      document.title = 'Plan'
      onStopped(r)
    }), [session.id, onStopped])

  // "✓ Done" from the top timer bar or a task card finishes right away.
  const finishedFromBar = useRef(false)
  useEffect(() => {
    if (finishNow && !finishedFromBar.current) { finishedFromBar.current = true; stop(false) }
  }, [finishNow, stop])

  // End-of-session tone; timebox hard-stops 2 minutes after its budget (DESIGN §6.2 Mode 4).
  useEffect(() => {
    if (overTime && !chimed.current && !session.pausedAt) {
      chimed.current = true
      if (sound) chime()
    }
    if (session.mode === 'timebox' && remaining !== null && remaining <= -120 && !autoStopped.current) {
      autoStopped.current = true
      stop(false)
    }
  }, [overTime, remaining, session.mode, session.pausedAt, sound, stop])

  // Tab title shows remaining time (or "Running" in Blind mode).
  useEffect(() => {
    document.title = session.pausedAt ? '⏸ Paused · Plan' : blind ? '● Running · Plan' : `${fmtClock(remaining !== null ? Math.max(0, remaining) : elapsed)} · Plan`
  }, [elapsed, remaining, blind, session.pausedAt])
  useEffect(() => () => { document.title = 'Plan' }, [])

  const togglePause = () =>
    start(async () => {
      if (session.pausedAt) {
        const r = await resumeSession(session.id)
        if (!r.ok) return void toast(r.error)
        const add = Math.round((Date.now() - new Date(session.pausedAt).getTime()) / 1000)
        setSession({ ...session, pausedAt: null, pausedSeconds: session.pausedSeconds + add })
      } else {
        const r = await pauseSession(session.id)
        if (!r.ok) return void toast(r.error)
        setSession({ ...session, pausedAt: new Date().toISOString() })
      }
    })

  const distract = (kind: 'internal' | 'external') => {
    setDistractMode(false)
    setAway(null)
    setDistractions((d) => d + 1)
    void logDistraction({ sessionId: session.id, kind }).then((r) => !r.ok && toast(r.error))
    toast(kind === 'internal' ? 'Noted. Back to it.' : 'Noted. Back when you can.', { duration: 1500 })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (parking) return
      const k = keyInfo(e)
      if ((k.ctrlKey || k.metaKey) && e.key === 'Enter') { e.preventDefault(); stop(false); return }
      const key = plainKey(k)
      if (!key) return
      // A focused button handles its own Enter/Space.
      const onButton = actionButton(e.target)
      if (distractMode) {
        if (key === 'i') distract('internal')
        else if (key === 'e') distract('external')
        else if (key === 'escape') setDistractMode(false)
        return
      }
      if (key === 'd') { e.preventDefault(); setDistractMode(true) }
      else if (key === 'p' || key === 'q') { e.preventDefault(); setParking(true) }
      else if (key === ' ' && !onButton) { e.preventDefault(); togglePause() }
      else if (key === 'enter' && !onButton) { e.preventDefault(); stop(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between text-sm text-white/40">
        <span className="flex items-center gap-3"><Link href="/" className="font-bold hover:text-white">← Today</Link><span>{MODE_EMOJI[session.mode]} {MODE_LABEL[session.mode]}{session.mode === 'ladder' && session.plannedMinutes ? ` · ${session.plannedMinutes}m` : ''}</span></span>
        <div className="flex items-center gap-3">
          <button onClick={() => setGuard((g) => !g)} aria-pressed={guard} title="Phone guard: ask what pulled you when you leave this screen"
            className={`flex items-center gap-1 ${guard ? 'text-teal-200' : 'hover:text-white'}`}><Shield className="size-3.5" />Guard</button>
          <button onClick={toggleNoise} aria-pressed={noise} title="Soft background noise"
            className={`flex items-center gap-1 ${noise ? 'text-teal-200' : 'hover:text-white'}`}>{noise ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}Noise</button>
          <button disabled={pending} onClick={() => confirm('Discard this session? It won’t count.') && stop(true)} className="hover:text-white">Discard</button>
        </div>
      </div>

      <div className="my-auto flex flex-col items-center gap-2 py-2 text-center">
        {task.reentryNote && <p className="text-sm text-white/50">Last time: {task.reentryNote}</p>}
        <h1 className="text-2xl font-extrabold leading-snug">{task.firstAction || task.title}</h1>
        {session.goal && <p className="text-white/60">Goal: {session.goal}</p>}

        <FocusGauge elapsed={elapsed} plannedSec={plannedSec} blind={blind} paused={!!session.pausedAt}
          endsAt={plannedSec !== null ? new Date(new Date(session.startedAt).getTime() + (plannedSec + session.pausedSeconds) * 1000) : null}
          label={wrapUp && !overTime ? 'Wrap up' : overTime && session.mode === 'ladder' ? 'Rung complete' : undefined} />

        {starterCheck && (
          <div className="space-y-3">
            <p className="text-white/80">Five minutes done. Keep going?</p>
            <div className="flex justify-center gap-2">
              <button className="rounded-xl bg-teal-300 px-5 py-2.5 font-medium text-[oklch(0.2_0.02_185)]"
                onClick={() => start(async () => { await extendStarter(session.id); setSession({ ...session, plannedMinutes: null }) })}>Keep going</button>
              <button className="rounded-xl bg-white/10 px-5 py-2.5" onClick={() => stop(false)}>Stop here — that counts</button>
            </div>
          </div>
        )}
        {overTime && session.mode === 'ladder' && <p className="text-sm text-teal-200">Rung complete. Finish when you’re ready.</p>}

        <div className="flex h-3 items-center gap-1.5" aria-label={`${distractions} distractions logged`}>
          {Array.from({ length: Math.min(distractions, 12) }).map((_, i) => <span key={i} className="size-1.5 rounded-full bg-white/40" />)}
        </div>
      </div>

      {away !== null && !distractMode && (
        <div className="mx-auto mb-3 w-full max-w-md space-y-2 rounded-xl border border-white/10 p-3 text-sm">
          <p className="text-white/80">Away for {away >= 60 ? `${Math.floor(away / 60)}m ${away % 60}s` : `${away}s`}. What pulled you?</p>
          <div className="flex gap-2">
            <button onClick={() => distract('internal')} className="h-10 flex-1 rounded-lg bg-white/10 hover:bg-white/15">An urge</button>
            <button onClick={() => distract('external')} className="h-10 flex-1 rounded-lg bg-white/10 hover:bg-white/15">Someone / something</button>
            <button onClick={() => setAway(null)} className="h-10 flex-1 rounded-lg text-white/60 hover:bg-white/5">For this task</button>
          </div>
        </div>
      )}
      {distractMode ? (
        <div className="mx-auto flex w-full max-w-md gap-2">
          <button onClick={() => distract('internal')} className="h-12 flex-1 rounded-2xl bg-white/10 font-bold hover:bg-white/15">💭 My own urge <kbd className="ml-1 text-white/40">I</kbd></button>
          <button onClick={() => distract('external')} className="h-12 flex-1 rounded-2xl bg-white/10 font-bold hover:bg-white/15">🔔 Someone / something <kbd className="ml-1 text-white/40">E</kbd></button>
        </div>
      ) : (
        <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-2 text-sm">
          <Ctl label="Got distracted" k="D" onClick={() => setDistractMode(true)} icon={<span aria-hidden>🫧</span>} />
          <Ctl label="Park a thought" k="P" onClick={() => setParking(true)} icon={<span aria-hidden>📝</span>} />
          <Ctl label={session.pausedAt ? 'Resume' : 'Pause'} k="Space" onClick={togglePause} icon={session.pausedAt ? <Play className="size-4" /> : <Pause className="size-4" />} />
          <Ctl label="I’m done" k="Enter ⏎" onClick={() => stop(false)} icon={<Square className="size-4" />} primary />
        </div>
      )}
      <CaptureDialog open={parking} onOpenChange={setParking} parked />
    </div>
  )
}

function Ctl({ label, k, onClick, icon, primary }: { label: string; k: string; onClick: () => void; icon?: React.ReactNode; primary?: boolean }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-3 font-bold transition-colors ${primary ? 'bg-teal-300/20 text-teal-100 hover:bg-teal-300/30' : 'bg-white/[0.07] text-white/80 hover:bg-white/[0.12]'}`}>
      {icon}<span>{label}</span><kbd className="text-[10px] text-white/35">{k}</kbd>
    </button>
  )
}

// ───────────── After: reveal + protocol step 3 ─────────────

function After({ task, session, result, tone, goalLevel, run }: {
  task: FocusTask; session: RunningSession; result: StopResult; tone: Tone; goalLevel: GuideLevel; run: RunInfo | null
}) {
  const router = useRouter()
  const [feel, setFeel] = useState<'yes' | 'partial' | 'no' | null>(null)
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [taskDone, setTaskDone] = useState(false)
  const [pending, start] = useTransition()
  const abandoned = result.outcome === 'abandoned'

  // A small, earned celebration (DESIGN §10.11): only for real sessions.
  useEffect(() => {
    if (abandoned) return
    const colors = ['#2A9D92', '#E9A23B', '#4F83E8', '#8068D2', '#3FA96C']
    const bits = Array.from({ length: 36 }, (_, i) => {
      const c = document.createElement('i')
      c.className = 'confetti'
      c.style.left = `${Math.random() * 100}vw`
      c.style.background = colors[i % colors.length]!
      c.style.animationDelay = `${Math.random() * 0.4}s`
      document.body.appendChild(c)
      return c
    })
    const t = setTimeout(() => bits.forEach((b) => b.remove()), 2300)
    return () => { clearTimeout(t); bits.forEach((b) => b.remove()) }
  }, [abandoned])

  const reveal = useMemo(() => {
    if (abandoned) return { title: 'Session discarded', body: 'Under 2 minutes — it won’t count. That’s fine.' }
    if (result.mode === 'blind' && result.predictedMinutes) {
      const diff = Math.round(((result.activeMinutes - result.predictedMinutes) / result.predictedMinutes) * 100)
      return {
        title: `You guessed ${result.predictedMinutes} min · it took ${result.activeMinutes}`,
        body: diff === 0 ? 'Spot on! 🎯' : Math.abs(diff) <= 15 ? 'Really close 👏' : diff > 0 ? `${diff}% longer than you thought — good to know.` : `${-diff}% quicker than you thought.`,
      }
    }
    if (result.mode === 'starter') return { title: say(tone, 'starter_stopped'), body: `${result.activeMinutes} minutes in. Starting is the hard part.` }
    if (result.ladderEvent === 'climbed') return { title: say(tone, 'climbed', { rung: result.rung }), body: 'Your focus just grew 🌱' }
    if (result.mode === 'ladder' && result.clean) return { title: `${result.activeMinutes} calm minutes 🎉`, body: `${result.cleanCount} of 3 toward your next level (${result.rung} min).` }
    if (result.outcome === 'stopped_early') return { title: `${result.activeMinutes} minutes of focus`, body: 'Stopped early — that’s information, not failure.' }
    return { title: `${result.activeMinutes} minutes of real focus! 🎉`, body: result.distractions ? `${result.distractions} distraction${result.distractions > 1 ? 's' : ''} noted.` : 'Not a single distraction. Lovely.' }
  }, [result, tone, abandoned])

  // In a run, saving moves straight to the next task (a break stays one tap away).
  const save = (toNext: boolean) =>
    start(async () => {
      if (!abandoned) {
        const goalMet = session.goal ? feel : null
        const quality = feel === 'yes' ? 5 : feel === 'partial' ? 3 : feel === 'no' ? 2 : null
        const r = await reviewSession({ id: session.id, goalMet, quality, reentryNote: note || null, taskDone })
        if (!r.ok) return void toast(r.error)
      }
      if (toNext && run?.next) router.push(`/focus?task=${run.next.id}&run=1`)
      else {
        if (run && !run.next && !abandoned) toast.success('List done 🎉')
        router.push(abandoned && !run?.next ? '/' : `/focus/break?m=${result.breakMinutes}&s=${session.id}`)
      }
      router.refresh()
    })

  // 1–3 rate it, F = task finished, Enter saves (moves on in a run).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat || pending) return
      const k = keyInfo(e)
      if (k.ctrlKey || k.metaKey || k.altKey) return
      const onButton = actionButton(e.target)
      if (e.key === 'Enter' && !onButton) { e.preventDefault(); save(!!run?.next) }
      if (k.typing || abandoned) return
      if (e.key === '1') setFeel('yes')
      else if (e.key === '2') setFeel('partial')
      else if (e.key === '3') setFeel('no')
      else if (e.key.toLowerCase() === 'f') setTaskDone((d) => !d)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="my-auto space-y-7 py-8">
      <div className={`text-center ${abandoned ? '' : 'animate-pop'}`}>
        {!abandoned && <p className="text-5xl" aria-hidden>🎉</p>}
        <p className="mt-2 text-2xl font-extrabold">{reveal.title}</p>
        <p className="mt-1 text-white/60">{reveal.body}</p>
      </div>
      {!abandoned && (
        <div className="mx-auto max-w-md space-y-4">
          <p className="text-center font-bold text-white/80">{session.goal ? `“${session.goal}” — did you get there?` : 'How did it go?'}</p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="How did it go">
            {([['yes', '😄', 'Yes!'], ['partial', '🙂', 'Partly'], ['no', '😕', 'Not yet']] as const).map(([id, emo, label], i) => (
              <button key={id} onClick={() => setFeel(id)} aria-pressed={feel === id}
                className={`flex flex-col items-center gap-1 rounded-2xl py-3 font-bold transition-all ${feel === id ? 'bg-teal-300/20 ring-2 ring-teal-300' : 'bg-white/[0.07] hover:bg-white/[0.12]'}`}>
                <span className="text-3xl">{emo}</span>{label}<kbd className="text-[10px] text-white/35">{i + 1}</kbd>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-sm">
            <button onClick={() => setTaskDone((d) => !d)} aria-pressed={taskDone}
              className={`rounded-full px-3.5 py-1.5 font-bold ${taskDone ? 'bg-teal-300/25 text-teal-100' : 'bg-white/[0.07] text-white/70'}`}>{taskDone ? '✓ Task finished' : 'Task finished?'}</button>
            {!taskDone && <button onClick={() => setShowNote((x) => !x)} className="rounded-full bg-white/[0.07] px-3.5 py-1.5 font-bold text-white/70">📝 Note for next time</button>}
          </div>
          {showNote && !taskDone && (
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} autoFocus aria-label="Next time, start by"
              placeholder={goalLevel === 'full' ? 'Next time, start by… e.g. question 14 on page 82' : 'Next time, start by…'}
              className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 outline-none focus:border-teal-300/60" />
          )}
        </div>
      )}
      {run?.next ? (
        <div className="mx-auto w-full max-w-md space-y-2">
          <button disabled={pending} onClick={() => save(true)}
            className="block h-12 w-full truncate rounded-2xl bg-teal-300 px-4 font-extrabold text-[#0E2220] disabled:opacity-40">
            Save · next: {run.next.title} <kbd className="ml-1 text-[11px] opacity-60">Enter ↵</kbd>
          </button>
          {!abandoned && <button disabled={pending} onClick={() => save(false)} className="block w-full text-center text-sm font-bold text-white/60 hover:text-white">Take a break first</button>}
        </div>
      ) : (
        <button disabled={pending} onClick={() => save(false)}
          className="mx-auto block h-12 w-full max-w-md rounded-2xl bg-teal-300 font-extrabold text-[#0E2220] disabled:opacity-40">
          {abandoned ? 'Back home' : run ? 'Save · list done — take a break' : 'Save & take a break'} <kbd className="ml-1 text-[11px] opacity-60">Enter ↵</kbd>
        </button>
      )}
      <p className="text-center text-xs text-white/40">{task.title}</p>
    </div>
  )
}
