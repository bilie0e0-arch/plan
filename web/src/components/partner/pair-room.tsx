'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, ListChecks, Plus, Square, Users, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { logDistraction, reviewSession, startSession, stopSession } from '@/app/actions/focus'
import { addSharedItem, taskForSharedItem, toggleSharedItem } from '@/app/actions/partner'
import { beat, takeResume } from '@/lib/client/partner-feed'
import { useStepKeys } from '@/lib/client/use-step-keys'
import { chime } from '@/lib/client/chime'
import { fmtClock } from '@/lib/format'
import { PairCall } from './pair-call'
import { Kbd } from '@/components/ui/kbd'
import { FocusGauge } from '@/components/focus/focus-gauge'

export type RoomTask = { id: string; title: string }
/** A shared list you have with someone in this room (each list belongs to one friendship). */
export interface RoomList { id: string; title: string; withName: string; items: { id: string; title: string; done: boolean }[] }
type CallMode = 'video' | 'audio' | 'none'
interface CoSession {
  id: string; minutes: number; round: number; status: 'checkin' | 'running' | 'break' | 'ended'; starts_at: string | null; break_until: string | null
  call_mode: CallMode; call_changed_by: string | null; call_changed_at: string | null
}
interface Member { user_id: string; ready: boolean; goal_set: boolean; goal_text: string | null; task_title: string | null; result: string | null; wants_next: boolean; left_at: string | null }

const POLL_MS = 1500
const CALLS: [CallMode, string][] = [['video', '📹 Video'], ['audio', '🎧 Audio'], ['none', '🤫 No call']]
const CALL_NAME: Record<CallMode, string> = { video: 'video', audio: 'audio only', none: 'no call' }

const joinNames = (names: string[]) => names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/**
 * Study room (friends: 2–5 people): check-in → shared 3-2-1 → focus together on one shared clock → private review +
 * shared check-out → break → another round? Each person's focus is a normal session of their own (it counts for
 * their skills); the room keeps everyone in step. One call type for the whole room, switchable by anyone.
 */
export function PairRoom(props: { id: string; userId: string; people: { id: string; name: string }[]; callLink: string | null; tasks: RoomTask[]; lists: RoomList[]; sound: boolean }) {
  const [cs, setCs] = useState<CoSession | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [lists, setLists] = useState(props.lists)
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [pending, start] = useTransition()
  const [people, setPeople] = useState(props.people)
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? 'A friend'

  // Check-in choices (kept on this device; only "a goal is set" is shared unless you share exactly).
  const [taskKey, setTaskKey] = useState(() => props.tasks[0] ? `task:${props.tasks[0].id}` : '')
  const [goal, setGoal] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const mySession = useRef<{ id: string; round: number } | null>(null)
  const [myDone, setMyDone] = useState<{ round: number; outcome: string } | null>(null)
  const [resume] = useState(() => (typeof window === 'undefined' ? null : takeResume()))
  const chimed = useRef<number>(0)
  const known = useRef(new Set(props.people.map((p) => p.id)))
  const lastSwitch = useRef<string | null | undefined>(undefined)
  const listIds = props.lists.map((l) => l.id).join(',')

  const load = useCallback(async () => {
    const sb = createClient()
    const [c, m, li] = await Promise.all([
      sb.from('co_sessions').select('id, minutes, round, status, starts_at, break_until, call_mode, call_changed_by, call_changed_at').eq('id', props.id).maybeSingle(),
      sb.from('co_session_members').select('user_id, ready, goal_set, goal_text, task_title, result, wants_next, left_at').eq('co_session_id', props.id),
      listIds ? sb.from('shared_list_items').select('id, list_id, title, done_at').in('list_id', listIds.split(',')).order('created_at') : Promise.resolve({ data: null }),
    ])
    if (c.data) setCs(c.data as CoSession)
    else setCs((x) => (x ? { ...x, status: 'ended' } : { id: props.id, minutes: 0, round: 1, status: 'ended', starts_at: null, break_until: null, call_mode: 'none', call_changed_by: null, call_changed_at: null }))
    const list = (m.data ?? []) as Member[]
    setMembers(list)
    if (li.data) {
      const items = li.data
      setLists((ls) => ls.map((l) => ({ ...l, items: items.filter((i) => i.list_id === l.id).map((i) => ({ id: i.id, title: i.title, done: !!i.done_at })).sort((a, b) => Number(a.done) - Number(b.done)) })))
    }
    // Someone new joined a group room: fetch their name (names only).
    if (list.some((x) => x.user_id !== props.userId && !known.current.has(x.user_id))) {
      const { data } = await sb.rpc('session_people', { p_cs: props.id })
      const next = (data ?? []).filter((p) => p.user_id !== props.userId).map((p) => ({ id: p.user_id, name: p.display_name || `@${p.username}` }))
      next.forEach((p) => known.current.add(p.id))
      list.forEach((x) => known.current.add(x.user_id))
      setPeople(next)
    }
  }, [props.id, props.userId, listIds])

  useEffect(() => {
    const sb = createClient()
    const t0 = Date.now()
    void sb.rpc('server_now').then(({ data }) => { if (data) setOffset(new Date(data as string).getTime() - (t0 + Date.now()) / 2) })
    // Polling subscription; the first load runs on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    const poll = setInterval(() => void load(), POLL_MS)
    const clock = setInterval(() => setNow(Date.now()), 250)
    return () => { clearInterval(poll); clearInterval(clock) }
  }, [load])

  // Someone else switched the call for everyone: say so once.
  useEffect(() => {
    if (!cs) return
    if (lastSwitch.current !== undefined && cs.call_changed_at !== lastSwitch.current && cs.call_changed_by && cs.call_changed_by !== props.userId) {
      toast(`${people.find((p) => p.id === cs.call_changed_by)?.name ?? 'A friend'} switched the call to ${CALL_NAME[cs.call_mode]}.`)
    }
    lastSwitch.current = cs.call_changed_at
  }, [cs, people, props.userId])

  const serverNow = now + offset
  const me = members.find((m) => m.user_id === props.userId)
  const others = members.filter((m) => m.user_id !== props.userId)
  const here = others.filter((m) => !m.left_at)
  const gone = others.filter((m) => m.left_at)
  const roomName = joinNames(others.map((m) => nameOf(m.user_id))) || 'your friends'
  const status = cs?.status ?? 'checkin'
  const startsAt = cs?.starts_at ? new Date(cs.starts_at).getTime() : null
  const endsAt = startsAt && cs ? startsAt + cs.minutes * 60_000 : null
  const counting = status === 'running' && startsAt !== null && serverNow < startsAt
  const running = status === 'running' && startsAt !== null && serverNow >= startsAt
  const allLeft = others.length > 0 && here.length === 0
  const ended = status === 'ended' || !!me?.left_at
  const focusing = running && !!me?.ready && (!myDone || myDone.round !== cs?.round)

  const titleOf = (key: string) => {
    const [kind, id] = key.split(':')
    if (kind === 'task') return props.tasks.find((t) => t.id === id)?.title ?? null
    for (const l of lists) { const i = l.items.find((x) => x.id === id); if (i) return i.title }
    return null
  }

  // Presence for your friends' sidebar.
  useEffect(() => {
    if (running && endsAt) void beat('focus', new Date(endsAt - offset).toISOString())
    else if (status === 'break') void beat('break')
    else void beat('online')
  }, [running, status, endsAt, offset])

  // At the shared start, each person begins their own normal session (it counts for their skills).
  const titleRef = useRef(titleOf)
  useEffect(() => { titleRef.current = titleOf })
  useEffect(() => {
    if (!running || !cs || mySession.current?.round === cs.round || myDone?.round === cs.round || !me?.ready) return
    mySession.current = { id: '', round: cs.round }
    void (async () => {
      let taskId = taskKey.split(':')[1] ?? ''
      if (taskKey.startsWith('shared:')) {
        const r = await taskForSharedItem(titleRef.current(taskKey) ?? 'Shared list item')
        if (!r.ok) return void toast(r.error)
        taskId = r.taskId
      }
      if (!taskId) return void toast('Pick something to work on first.')
      const r = await startSession({ taskId, mode: 'timebox', suggestedMode: null, goal: goal.trim() || null, predicted: null, plannedMinutes: cs.minutes })
      if (!r.ok) { toast(r.error); return }
      mySession.current = { id: r.id, round: cs.round }
    })()
  }, [running, cs, me?.ready, myDone?.round, taskKey, goal])

  // One soft chime when the shared time is up.
  useEffect(() => {
    if (running && endsAt && serverNow >= endsAt && cs && chimed.current !== cs.round) {
      chimed.current = cs.round
      if (props.sound) chime()
    }
  }, [running, endsAt, serverNow, cs, props.sound])

  const rpc = (fn: string, args: Record<string, unknown>) =>
    start(async () => {
      const { error } = await createClient().rpc(fn as never, args as never)
      if (error) toast(error.message.includes('not_in_session') ? 'This session has ended.' : 'Something went wrong.')
      void load()
    })

  const ready = () => {
    const title = titleOf(taskKey)
    if (!title || !cs) return void toast('Pick something to work on.')
    rpc('co_ready', { p_cs: props.id, p_goal: goal, p_task_title: title, p_call: cs.call_mode })
  }
  const switchCall = (mode: CallMode) => { if (cs && mode !== cs.call_mode) rpc('co_set_call', { p_cs: props.id, p_call: mode }) }

  const finish = () =>
    start(async () => {
      const s = mySession.current
      if (!s?.id || !cs) return
      const r = await stopSession({ id: s.id, discarded: false })
      if (!r.ok) return void toast(r.error)
      setMyDone({ round: cs.round, outcome: r.outcome })
    })

  const checkout = (result: 'yes' | 'partial' | 'no') =>
    start(async () => {
      const s = mySession.current
      if (s?.id && myDone?.outcome !== 'abandoned') await reviewSession({ id: s.id, goalMet: goal.trim() ? result : null, quality: null, reentryNote: null, taskDone: false })
      const { error } = await createClient().rpc('co_finish', { p_cs: props.id, p_result: result })
      if (error) toast('Could not save.')
      void load()
    })

  const leave = () =>
    start(async () => {
      const s = mySession.current
      if (s?.id && !myDone) await stopSession({ id: s.id, discarded: false })
      await createClient().rpc('co_leave', { p_cs: props.id })
      void beat('online')
      void load()
    })

  const distracted = () => {
    const s = mySession.current
    if (s?.id) void logDistraction({ sessionId: s.id, kind: 'internal' }).then(() => toast('Noted. Back to it.', { duration: 1500 }))
  }
  const finishRef = useRef(finish)
  const distractRef = useRef(distracted)
  useEffect(() => { finishRef.current = finish; distractRef.current = distracted })
  // Same keys as solo focus: Enter finishes, D notes a distraction.
  useEffect(() => {
    if (!focusing) return
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return
      if (e.key === 'Enter') { e.preventDefault(); finishRef.current() }
      else if (e.key.toLowerCase() === 'd') { e.preventDefault(); distractRef.current() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusing])
  // Check-in: Enter = I'm ready.
  useStepKeys({ enabled: !!cs && !ended && !me?.ready && !pending && !listOpen, onNext: ready })

  if (!cs) return <main className="flex min-h-dvh items-center justify-center text-white/50">Opening the room…</main>

  // ───── Ended: back to solo ─────
  if (ended) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        <Users className="size-8 text-teal-300" />
        <h1 className="text-2xl font-extrabold">Nice session together.</h1>
        <p className="text-white/60">{cs.round > 1 ? `${cs.round} rounds` : 'One round'} with {roomName}.</p>
        {resume ? (
          <div className="w-full space-y-2">
            <p className="text-sm text-white/70">Resume “{resume.title}” ({resume.minutes} min done)?</p>
            <Link href={`/focus?task=${resume.taskId}`} className="block h-12 rounded-xl bg-teal-300 pt-3 font-medium text-[oklch(0.2_0.02_185)]">Resume</Link>
            <Link href="/" className="block text-sm text-white/60 hover:text-white">Done for now</Link>
          </div>
        ) : (
          <Link href="/" className="h-12 w-full rounded-xl bg-teal-300 pt-3 font-medium text-[oklch(0.2_0.02_185)]">Back home</Link>
        )}
      </main>
    )
  }

  const peers = cs.call_mode !== 'none' ? here.map((m) => ({ id: m.user_id, name: nameOf(m.user_id) })) : []
  const notReady = here.filter((m) => !m.ready).map((m) => nameOf(m.user_id))
  const over = running && endsAt !== null && serverNow >= endsAt
  const openItems = lists.reduce((n, l) => n + l.items.filter((i) => !i.done).length, 0)
  const canSwitch = status !== 'running' || !me?.ready

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 px-6 py-5">
      <div className="flex items-center justify-between gap-3 text-sm text-white/50">
        <button disabled={pending} onClick={leave} className="flex items-center gap-1 hover:text-white"><X className="size-4" /> Leave</button>
        <span className="truncate">{others.length > 1 ? 'Study room' : 'Together'} with {roomName} · round {cs.round} · {cs.minutes} min</span>
      </div>

      {gone.length > 0 && (
        <p className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/80">
          {joinNames(gone.map((m) => nameOf(m.user_id)))} had to go. {allLeft ? 'Keep going solo — your timer continues.' : 'The rest of you carry on.'}
        </p>
      )}

      {/* One call for the whole room. It stays mounted across phases; while focusing, video shrinks to a side strip. */}
      {peers.length > 0 && (
        <PairCall key={`${cs.call_mode}:${cs.call_changed_at ?? ''}`} epoch={cs.call_changed_at ?? 'start'} coSessionId={props.id} userId={props.userId} peers={peers}
          video={cs.call_mode === 'video'} focusing={running && !over} compact={focusing || counting} callLink={props.callLink} />
      )}
      {canSwitch && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
          <span className="text-white/45">Call for everyone:</span>
          <div role="radiogroup" aria-label="Call for everyone" className="flex gap-1">
            {CALLS.map(([m, l]) => (
              <button key={m} role="radio" aria-checked={cs.call_mode === m} disabled={pending} onClick={() => switchCall(m)}
                className={`rounded-full border px-2.5 py-1 font-bold ${cs.call_mode === m ? 'border-teal-300 bg-teal-300/15 text-teal-100' : 'border-white/10 text-white/55 hover:bg-white/5'}`}>{l}</button>
            ))}
          </div>
        </div>
      )}

      {/* ───── Check-in ───── */}
      {!me?.ready && (
        <section className="mx-auto w-full max-w-md space-y-4 py-2">
          <h1 className="text-center text-2xl font-extrabold">Check in</h1>
          <div className="space-y-1">
            <span className="text-sm text-white/60">Working on</span>
            {props.tasks.length === 0 && openItems === 0 ? <p className="rounded-xl border border-white/15 px-3 py-3 text-sm text-white/60">Nothing on Today — add a task first</p> : (
              <div role="radiogroup" aria-label="Working on" className="max-h-56 space-y-1.5 overflow-y-auto">
                {props.tasks.length > 0 && <p className="pt-1 text-[11px] font-black uppercase tracking-wider text-white/40">My tasks</p>}
                {props.tasks.map((t) => <Choice key={t.id} k={`task:${t.id}`} title={t.title} on={taskKey === `task:${t.id}`} pick={setTaskKey} />)}
                {lists.filter((l) => l.items.some((i) => !i.done)).map((l) => (
                  <div key={l.id} className="space-y-1.5">
                    <p className="pt-2 text-[11px] font-black uppercase tracking-wider text-white/40">📋 {l.title} · shared with {l.withName}</p>
                    {l.items.filter((i) => !i.done).map((i) => <Choice key={i.id} k={`shared:${i.id}`} title={i.title} on={taskKey === `shared:${i.id}`} pick={setTaskKey} />)}
                  </div>
                ))}
              </div>
            )}
          </div>
          <label className="block space-y-1">
            <span className="text-sm text-white/60">By the end I’ll have…</span>
            <input value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={200} placeholder="e.g. section 4.1 done"
              className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 outline-none focus:border-teal-300/60" />
          </label>
          {here.map((m) => <PartnerStatus key={m.user_id} name={nameOf(m.user_id)} m={m} />)}
          <button disabled={!taskKey || pending} onClick={ready} className="h-12 w-full rounded-xl bg-teal-300 font-medium text-[oklch(0.2_0.02_185)] disabled:opacity-40">
            I’m ready <Kbd>Enter ↵</Kbd>
          </button>
          {cs.call_mode !== 'none' && <p className="text-center text-xs text-white/40">Mics are muted while you focus and turn on during breaks.</p>}
        </section>
      )}

      {status === 'checkin' && me?.ready && (
        <section className="mx-auto w-full max-w-md space-y-4 py-6 text-center">
          <p className="text-lg">You’re ready.</p>
          {here.map((m) => <PartnerStatus key={m.user_id} name={nameOf(m.user_id)} m={m} />)}
          <p className="text-sm text-white/50">{notReady.length ? `Waiting for ${joinNames(notReady)}…` : here.length ? '' : 'Waiting for your friends…'}</p>
          {allLeft && <button onClick={leave} className="h-11 w-full rounded-xl bg-white/10">End</button>}
        </section>
      )}

      {/* ───── 3-2-1 ───── */}
      {counting && startsAt && me?.ready && (
        <div className="flex flex-1 items-center justify-center">
          <span key={Math.ceil((startsAt - serverNow) / 1000)} className="animate-settle text-8xl font-light tabular">{Math.max(1, Math.ceil((startsAt - serverNow) / 1000))}</span>
        </div>
      )}

      {/* ───── Focus together ───── */}
      {focusing && (
        <section className="flex flex-1 flex-col items-center gap-4">
          {/* One shared speedometer clock — everyone in the room sees the same time. */}
          <FocusGauge elapsed={startsAt ? Math.max(0, Math.floor((serverNow - startsAt) / 1000)) : 0} plannedSec={cs.minutes * 60} blind={false} paused={false}
            endsAt={endsAt ? new Date(endsAt - offset) : null} label={over ? 'Time’s up' : undefined} />
          <div aria-label="In the room" className="flex flex-wrap justify-center gap-2">
            <span className="rounded-full bg-teal-300/15 px-3 py-1.5 text-sm font-bold text-teal-100">You<span className="font-normal text-teal-100/60"> · {titleOf(taskKey)}</span></span>
            {others.map((m) => (
              <span key={m.user_id} className={`rounded-full bg-white/5 px-3 py-1.5 text-sm font-bold ${m.left_at ? 'text-white/35 line-through' : 'text-white/80'}`}>
                {nameOf(m.user_id)}
                <span className="font-normal text-white/50">{m.left_at ? '' : m.task_title ? ` · ${m.task_title}` : m.goal_set ? ' · goal ✓' : m.ready ? ' · focusing' : ' · checking in…'}</span>
              </span>
            ))}
          </div>
          {over && <p className="text-sm text-teal-200">Time’s up — finish when you’re ready.</p>}
          <div className="grid w-full max-w-md grid-cols-3 gap-2 text-sm">
            <button className="rounded-xl bg-white/5 py-3 text-white/70 hover:bg-white/10" onClick={distracted}>Distraction <Kbd>D</Kbd></button>
            <button disabled={pending} className="flex items-center justify-center gap-1 rounded-xl bg-white/5 py-3 text-white/70 hover:bg-white/10" onClick={() => rpc('co_extend', { p_cs: props.id, p_minutes: 5 })}><Plus className="size-3.5" />5 min</button>
            <button disabled={pending} className="flex items-center justify-center gap-1 rounded-xl bg-teal-300/15 py-3 text-teal-100 hover:bg-teal-300/25" onClick={finish}><Square className="size-3.5" />Finish <Kbd>Enter</Kbd></button>
          </div>
        </section>
      )}

      {/* ───── Check-out ───── */}
      {running && myDone?.round === cs.round && !me?.result && (
        <section className="mx-auto w-full max-w-md space-y-4 py-8 text-center">
          <h2 className="text-xl font-semibold">{goal.trim() ? `“${goal.trim()}” — did you get there?` : 'How did it go?'}</h2>
          <div className="grid grid-cols-3 gap-2">
            {(['yes', 'partial', 'no'] as const).map((r) => (
              <button key={r} disabled={pending} onClick={() => checkout(r)} className="h-11 rounded-xl border border-white/15 capitalize hover:bg-white/5">{r}</button>
            ))}
          </div>
          {taskKey.startsWith('shared:') && <p className="text-xs text-white/45">Finished “{titleOf(taskKey)}”? Tick it in the shared list (bottom left).</p>}
        </section>
      )}
      {running && me?.result && (
        <section className="mx-auto w-full max-w-md space-y-3 py-8 text-center">
          <p className="text-lg">You: {me.result === 'yes' ? 'goal met ✓' : me.result === 'partial' ? 'partly ✓' : 'not this time'}</p>
          <p className="text-sm text-white/60">{here.some((m) => !m.result) ? `Waiting for ${joinNames(here.filter((m) => !m.result).map((m) => nameOf(m.user_id)))} to finish…` : ''}</p>
        </section>
      )}

      {/* ───── Break together ───── */}
      {status === 'break' && me?.ready && (
        <section className="mx-auto w-full max-w-md space-y-5 py-6 text-center">
          <p className="text-sm uppercase tracking-wide text-white/40">Break together</p>
          <p className="text-6xl font-light tabular">{fmtClock(Math.max(0, Math.round(((cs.break_until ? new Date(cs.break_until).getTime() : serverNow) - serverNow) / 1000)))}</p>
          <p className="text-white/70">You: {label(me?.result)}{here.map((m) => ` · ${nameOf(m.user_id)}: ${label(m.result)}`).join('')}</p>
          {me?.wants_next ? <p className="text-sm text-white/50">Waiting for {joinNames(here.filter((m) => !m.wants_next).map((m) => nameOf(m.user_id)))}…</p> : (
            <div className="space-y-2">
              <button disabled={pending || allLeft} onClick={() => rpc('co_next_round', { p_cs: props.id })} className="h-12 w-full rounded-xl bg-teal-300 font-medium text-[oklch(0.2_0.02_185)] disabled:opacity-40">Another round</button>
              <button disabled={pending} onClick={leave} className="w-full text-sm text-white/60 hover:text-white">End for now</button>
            </div>
          )}
        </section>
      )}

      {lists.length > 0 && <SharedLists lists={lists} open={listOpen} setOpen={setListOpen} openItems={openItems} reload={() => void load()} />}
    </main>
  )
}

function Choice({ k, title, on, pick }: { k: string; title: string; on: boolean; pick: (k: string) => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={() => pick(k)}
      className={`flex w-full items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left font-bold transition-colors ${on ? 'border-teal-300 bg-teal-300/15' : 'border-white/10 hover:bg-white/5'}`}>
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {on && <span aria-hidden className="text-teal-200">✓</span>}
    </button>
  )
}

/** The shared lists with people in this room — tick and add without leaving; everyone sees changes within seconds. */
function SharedLists({ lists, open, setOpen, openItems, reload }: { lists: RoomList[]; open: boolean; setOpen: (o: boolean) => void; openItems: number; reload: () => void }) {
  const [text, setText] = useState<Record<string, string>>({})
  const [, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await fn(); if (!r.ok) toast(r.error ?? 'Something went wrong.'); reload() })
  return (
    <div className="fixed bottom-4 left-4 z-30 w-[min(20rem,calc(100vw-2rem))]">
      {open && (
        <div role="dialog" aria-label="Shared list" className="mb-2 max-h-[60vh] space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-[#1f2a32] p-3 shadow-lg">
          {lists.map((l) => (
            <div key={l.id} className="space-y-1.5">
              <p className="text-sm font-bold">📋 {l.title} <span className="font-normal text-white/45">· with {l.withName}</span></p>
              <ul className="space-y-0.5">
                {l.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 text-sm">
                    <button aria-label={i.done ? `Undo ${i.title}` : `Done: ${i.title}`} onClick={() => run(() => toggleSharedItem(i.id, !i.done))}
                      className={`grid size-5 shrink-0 place-items-center rounded-md border ${i.done ? 'border-teal-300 bg-teal-300/20 text-teal-200' : 'border-white/25'}`}>{i.done && <Check className="size-3.5" />}</button>
                    <span className={i.done ? 'text-white/40 line-through' : 'text-white/85'}>{i.title}</span>
                  </li>
                ))}
                {l.items.length === 0 && <li className="text-xs text-white/45">No items yet.</li>}
              </ul>
              <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); const t = text[l.id] ?? ''; if (t.trim()) run(async () => { const r = await addSharedItem(l.id, t); if (r.ok) setText((x) => ({ ...x, [l.id]: '' })); return r }) }}>
                <input aria-label={`Add to ${l.title}`} value={text[l.id] ?? ''} onChange={(e) => setText((x) => ({ ...x, [l.id]: e.target.value }))} placeholder="Add an item"
                  className="h-8 min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-2 text-sm outline-none focus:border-teal-300/60" />
                <button type="submit" aria-label="Add" className="grid size-8 place-items-center rounded-lg bg-white/10 hover:bg-white/15"><Plus className="size-4" /></button>
              </form>
            </div>
          ))}
        </div>
      )}
      <button onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-[#1f2a32] px-3.5 py-2 text-sm font-bold text-white/80 shadow-lg hover:text-white">
        <ListChecks className="size-4" /> Shared list{openItems ? ` · ${openItems} left` : ' · all done ✓'}
      </button>
    </div>
  )
}

function label(r: string | null | undefined) {
  return r === 'yes' ? 'goal met ✓' : r === 'partial' ? 'partly ✓' : r === 'no' ? 'not this time' : '…'
}

function PartnerStatus({ name, m }: { name: string; m: Member | undefined }) {
  if (!m) return null
  return (
    <p className="text-center text-sm text-white/60">
      {name}: {m.left_at ? 'left' : m.ready ? 'ready ✓' : 'checking in…'}{m.task_title ? ` · ${m.task_title}` : ''}{m.goal_set && !m.left_at ? ' · goal set' : ''}
    </p>
  )
}
