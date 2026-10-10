'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, X } from 'lucide-react'
import { ensureBlockTask } from '@/app/actions/focus'
import { cancelBlock, updateBlock } from '@/app/actions/calendar'
import { fmtMinutes } from '@/lib/format'

/**
 * Block Launcher — the "sit down" sequence (DESIGN §10.6): what it serves, re-entry note,
 * setup checklist, block goal, then a 3-2-1 countdown into Focus Mode.
 */
export function LaunchScreen({ block, serves, checklist }: {
  block: {
    id: string; title: string; type: string; minutes: number; status: string; time: string; startIso: string; ifThen: string | null
    timerMode: string | null; firstAction: string | null; reentry: string | null; startsInMinutes: number
  }
  serves: { title: string; leftMinutes: number } | null
  checklist: string[]
}) {
  const router = useRouter()
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [goal, setGoal] = useState('')
  const [mode, setMode] = useState<'main' | 'shorten' | 'release'>('main')
  const [reason, setReason] = useState('')
  const [pending, start] = useTransition()

  const go = () =>
    start(async () => {
      if (block.type === 'speaking') return router.push(`/speak/drill?block=${block.id}`)
      const r = await ensureBlockTask(block.id)
      if (!r.ok) return void toast(r.error)
      const q = new URLSearchParams({ task: r.taskId, block: block.id, autostart: '1', mode: block.timerMode ?? 'timebox', minutes: String(block.minutes) })
      if (goal.trim()) q.set('goal', goal.trim())
      router.push(`/focus?${q.toString()}`)
    })

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-6">
      <div className="flex items-center justify-between text-sm text-white/50">
        <Link href="/" className="hover:text-white"><X className="inline size-4" /> Not now</Link>
        <span>{block.time} · {fmtMinutes(block.minutes)}</span>
      </div>

      {mode === 'main' && (
        <div className="my-auto space-y-6 py-8">
          <div className="space-y-1 text-center">
            {block.startsInMinutes > 1 && <p className="text-sm text-white/50">Starts in {block.startsInMinutes} min</p>}
            <h1 className="text-3xl font-semibold leading-tight">{block.title}</h1>
            {serves && <p className="text-sm text-teal-200/80">Serves: {serves.title} · {fmtMinutes(serves.leftMinutes)} left this week</p>}
            {block.reentry && <p className="pt-2 text-sm text-white/60">Last time: {block.reentry}</p>}
            {!block.reentry && block.ifThen && <p className="pt-2 text-sm text-white/60">{block.ifThen}</p>}
          </div>

          {checklist.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-white/40">Setup</p>
              {checklist.map((c, i) => (
                <button key={i} onClick={() => setChecked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-left text-sm hover:bg-white/5">
                  <span className={`flex size-5 items-center justify-center rounded-md border ${checked.has(i) ? 'border-teal-300 bg-teal-300 text-[oklch(0.2_0.02_185)]' : 'border-white/30'}`}>
                    {checked.has(i) && <Check className="size-3.5" />}
                  </span>
                  {c}
                </button>
              ))}
            </div>
          )}

          {block.type !== 'speaking' && (
            <label className="block space-y-1">
              <span className="text-sm text-white/60">Goal for this block</span>
              <input value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={200} placeholder={block.firstAction ?? 'e.g. 3 passages done'}
                className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 outline-none focus:border-teal-300/60" />
            </label>
          )}

          <button disabled={pending} onClick={go} className="h-12 w-full rounded-xl bg-teal-300 font-medium text-[oklch(0.2_0.02_185)] disabled:opacity-50">
            I’m ready — start
          </button>
          <div className="flex justify-center gap-5 text-sm text-white/60">
            <button className="hover:text-white" onClick={() => setMode('shorten')}>Shorten</button>
            <Link className="hover:text-white" href={`/calendar?move=${block.id}`}>Move</Link>
            <button className="hover:text-white" onClick={() => setMode('release')}>Release</button>
          </div>
        </div>
      )}

      {mode === 'shorten' && (
        <div className="my-auto space-y-4">
          <h2 className="text-xl font-semibold">How long can you give it?</h2>
          <div className="grid grid-cols-3 gap-2">
            {[5, 15, 25, 30, 45].filter((m) => m < block.minutes).map((m) => (
              <button key={m} disabled={pending} className="h-12 rounded-xl border border-white/15 hover:bg-white/5"
                onClick={() => start(async () => {
                  const r = await updateBlock({ id: block.id, start: block.startIso, minutes: m })
                  if (!r.ok) return void toast(r.error)
                  toast(m === 5 ? 'Five minutes counts. Go.' : `Shortened to ${m} min.`)
                  setMode('main')
                  router.refresh()
                })}>{m} min</button>
            ))}
          </div>
          <button className="text-sm text-white/50" onClick={() => setMode('main')}>Back</button>
        </div>
      )}

      {mode === 'release' && (
        <div className="my-auto space-y-4">
          <h2 className="text-xl font-semibold">Release this block?</h2>
          <p className="text-sm text-white/60">
            {block.status !== 'committed' ? 'It isn’t committed — it will just be removed.'
              : block.startsInMinutes >= 120 ? 'Releasing early with a reason is a good decision, not a miss.'
                : 'Less than 2 hours to go, so it will count as missed. Moving it may be better.'}
          </p>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" maxLength={200}
            className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 outline-none" />
          <div className="flex gap-2">
            <button className="h-11 flex-1 rounded-xl bg-white/10" onClick={() => setMode('main')}>Back</button>
            <button disabled={pending} className="h-11 flex-1 rounded-xl bg-teal-300 font-medium text-[oklch(0.2_0.02_185)]"
              onClick={() => start(async () => {
                const r = await cancelBlock({ id: block.id, reason: reason || null })
                if (!r.ok) return void toast(r.error)
                toast(r.released ? 'Released. Good call.' : 'Removed.')
                router.push('/')
              })}>Release</button>
          </div>
        </div>
      )}
    </main>
  )
}
