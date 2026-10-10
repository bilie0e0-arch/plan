'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Copy, Phone, Plus, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Chips, NumberStepper } from '@/components/ui/choice'
import {
  acceptSharedList, addSharedItem, createSharedList, removeFriend, respondPartnerRequest, sendReaction, setFriendShare, setQuestTarget,
  toggleSharedItem, updateSharing,
} from '@/app/actions/partner'
import { InviteDialog } from './invite-dialog'
import { ConnectPartner } from './connect-partner'
import { STATUS_DOT, STATUS_LABEL, type Status } from './partner-widget'
import { fmtMinutes } from '@/lib/format'
import type { FriendSnapshot, FriendsState, ShareLevel } from '@/lib/data/partner'

const LEVELS = [
  { value: 'exact', label: '📖 Exact', hint: 'Task names and weekly outcomes' },
  { value: 'count', label: '🔢 Count', hint: 'Numbers only, e.g. 3 planned · 2 done' },
  { value: 'private', label: '🔒 Private', hint: 'Nothing beyond your status' },
] as const
const RANK: Record<Status, number> = { focus: 0, break: 1, online: 2, offline: 3 }
const friendName = (f: { display_name: string | null; username: string }) => f.display_name || `@${f.username}`

type Run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) => void
const statusOf = (f: FriendSnapshot): Status => (f.presence?.status ?? 'offline') as Status

function minutesLeft(f: FriendSnapshot) {
  if (statusOf(f) !== 'focus' || !f.presence?.focus_until) return null
  return Math.max(0, Math.round((new Date(f.presence.focus_until).getTime() - Date.now()) / 60_000))
}

function trend(now: number, last: number) {
  if (!last && !now) return 'No focus logged yet this week.'
  if (!last) return `${fmtMinutes(now)} this week.`
  const d = Math.round(((now - last) / last) * 100)
  return `${fmtMinutes(now)} this week · last week ${fmtMinutes(last)}${d ? ` (${d > 0 ? '+' : ''}${d}%)` : ''}`
}

/** Friends (prototype docs/mockups/friends-ui.html): who's around on the left, one friend's panel on the right. */
export function FriendsPanel({ s, selected }: { s: FriendsState; selected: string | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const friends = [...s.friends].sort((a, b) => RANK[statusOf(a)] - RANK[statusOf(b)])
  const [sel, setSel] = useState(() => (friends.find((f) => f.user_id === selected) ?? friends[0])!.user_id)
  const [invite, setInvite] = useState<string[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [settings, setSettings] = useState(false)
  const f = friends.find((x) => x.user_id === sel) ?? friends[0]!
  const online = friends.filter((x) => statusOf(x) !== 'offline')
  const inviteList = friends.map((x) => ({ id: x.user_id, name: friendName(x), online: statusOf(x) !== 'offline' }))

  const run: Run = (fn, msg) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) toast(r.error ?? 'Something went wrong.')
      else if (msg) toast.success(msg)
      router.refresh()
    })
  const copy = async () => {
    try { await navigator.clipboard.writeText(s.code); toast.success('Code copied.') } catch { toast(s.code) }
  }

  return (
    <div className={`space-y-4 ${pending ? 'opacity-80' : ''}`}>
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Friends</h1>
        <span className="text-sm text-muted-foreground">{online.length} of {friends.length} around</span>
        <span className="flex-1" />
        <button onClick={copy} className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
          My code <span className="font-mono text-foreground" data-testid="partner-code">{s.code}</span><Copy className="size-3" />
        </button>
        <Button variant="outline" onClick={() => setAdding(true)}><Plus className="size-4" /> Add a friend</Button>
        <Button onClick={() => setInvite(online[0] ? [online[0].user_id] : [f.user_id])}>👥 Focus together</Button>
      </header>

      {s.incoming.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-accent/40 px-4 py-3 text-sm">
          <span className="flex-1"><b>@{r.username}</b>{r.displayName ? ` (${r.displayName})` : ''} wants to be study friends.</span>
          <Button size="sm" disabled={pending} onClick={() => run(() => respondPartnerRequest(r.id, 'accept'), 'You’re now study friends!')}>Accept</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => respondPartnerRequest(r.id, 'decline'))}>Not now</Button>
        </div>
      ))}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section aria-label="Friends list" className="space-y-1.5">
          {friends.map((x) => {
            const st = statusOf(x)
            const left = minutesLeft(x)
            const on = x.user_id === f.user_id
            return (
              <button key={x.user_id} aria-pressed={on} onClick={() => setSel(x.user_id)}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-card px-3 py-2.5 text-left shadow-soft transition-colors ${on ? 'border-primary' : 'border-transparent hover:border-border'}`}>
                <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-accent font-extrabold text-accent-foreground">
                  {friendName(x).replace('@', '').slice(0, 1).toUpperCase()}
                  <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card ${STATUS_DOT[st]}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{friendName(x)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {STATUS_LABEL[st]}{left !== null ? ` · ${left} min left` : ''}
                    {x.share_level !== 'private' && x.planned !== undefined ? ` · ${x.done ?? 0}/${x.planned} done` : ''}
                  </span>
                </span>
              </button>
            )
          })}
        </section>

        <FriendDetail key={f.user_id} f={f} s={s} pending={pending} run={run} onInvite={() => setInvite([f.user_id])} />
      </div>

      <button onClick={() => setSettings(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Settings2 className="size-3.5" /> My sharing settings (online status, invites, call link)
      </button>

      <InviteDialog open={!!invite} onOpenChange={(o) => !o && setInvite(null)} friends={inviteList} initial={invite ?? undefined} />
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add a friend</DialogTitle></DialogHeader>
          <ConnectPartner code={s.code} incoming={[]} outgoing={s.outgoing} compact />
        </DialogContent>
      </Dialog>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>My sharing settings</DialogTitle></DialogHeader>
          <SharingSettings me={s.me} run={run} pending={pending} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FriendDetail({ f, s, pending, run, onInvite }: { f: FriendSnapshot; s: FriendsState; pending: boolean; run: Run; onInvite: () => void }) {
  const name = friendName(f)
  const [listTitle, setListTitle] = useState('')
  const [item, setItem] = useState('')
  const quest = f.quest
  const questPct = quest && quest.target ? Math.min(100, Math.round((quest.minutes / quest.target) * 100)) : 0
  const lists = s.lists.filter((l) => l.groupId === f.group_id)
  const callTarget = f.call_link || s.me.callLink
  const st = statusOf(f)

  return (
    <section aria-label={name} className="space-y-3">
      <div className="space-y-3 rounded-2xl bg-card p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xl font-extrabold">{name}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`size-2 rounded-full ${STATUS_DOT[st]}`} />{f.presence ? STATUS_LABEL[st] : 'Status hidden'}</p>
          </div>
          {callTarget && <a href={callTarget} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm hover:bg-muted"><Phone className="size-3.5" /> Call</a>}
          <Button onClick={onInvite}>Focus with {name}</Button>
        </div>
        {f.share_level === 'private' ? (
          <p className="text-sm text-muted-foreground">{name} keeps their plans private.</p>
        ) : (
          <div className="space-y-1.5 text-sm">
            <p className="tabular">Today: <b>{f.done ?? 0}/{f.planned ?? 0}</b> done · {fmtMinutes(f.focus_today ?? 0)} focused{(f.slipped_today ?? 0) > 0 && ` · ${f.slipped_today} block${f.slipped_today === 1 ? '' : 's'} slipped`}</p>
            {f.tasks && f.tasks.length > 0 && (
              <ul className="max-h-24 space-y-0.5 overflow-y-auto">
                {f.tasks.map((t, i) => (
                  <li key={i} className={`flex items-center gap-2 ${t.done ? 'text-muted-foreground line-through' : ''}`}>
                    <span className={`size-1.5 rounded-full ${t.done ? 'bg-success' : 'bg-muted-foreground/40'}`} />{t.title}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">{name}: {trend(f.focus_week ?? 0, f.focus_last_week ?? 0)} · You: {trend(s.me.week?.focus_week ?? 0, s.me.week?.focus_last_week ?? 0)}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-xs font-bold text-muted-foreground">Cheer</span>
          <button className="rounded-full border px-3 py-1 hover:bg-muted" onClick={() => run(() => sendReaction('clap', f.group_id, f.user_id), 'Sent 👏')}>👏</button>
          <button className="rounded-full border px-3 py-1 hover:bg-muted" onClick={() => run(() => sendReaction('strong', f.group_id, f.user_id), 'Sent 💪')}>💪</button>
          {(f.slipped_today ?? 0) > 0 && (
            <button className="rounded-full border px-3 py-1 hover:bg-muted" onClick={() => run(() => sendReaction('nudge', f.group_id, f.user_id), 'Nudge sent — kindly.')}>🤝 Kind nudge</button>
          )}
        </div>
      </div>

      <div className="space-y-2 rounded-2xl bg-card p-4 shadow-soft">
        <p className="font-bold">What {name} sees of you</p>
        <Chips label="Sharing level" value={f.my_share_level} onChange={(lvl: ShareLevel) => run(() => setFriendShare(f.user_id, lvl), 'Saved.')} options={[...LEVELS]} />
        <p className="text-xs text-muted-foreground">Set separately for each friend. Any single task can be hidden from its menu.</p>
      </div>

      {quest && (
        <div className="space-y-2 rounded-2xl bg-card p-4 shadow-soft">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-bold">This week, together</p>
            <span className="text-sm tabular text-muted-foreground">{fmtMinutes(quest.minutes)} / {fmtMinutes(quest.target)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${questPct}%` }} /></div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{questPct >= 100 ? 'Goal reached ✓' : 'Both your focus minutes count. Never a ranking.'}</span>
            <span className="ml-auto"><NumberStepper label="hours target" value={Math.round(quest.target / 60)} min={1} max={60} unit="h"
              onChange={(h) => run(() => setQuestTarget(f.group_id, h), 'Target updated.')} /></span>
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-2xl bg-card p-4 shadow-soft">
        <p className="font-bold">Shared list{lists[0] ? <span className="font-normal text-muted-foreground"> · {lists[0].title}</span> : null}</p>
        {lists.length === 0 ? (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await createSharedList(f.group_id, listTitle); if (r.ok) setListTitle(''); return r }, `List created — ${name} will be asked to join.`) }}>
            <Input aria-label="Shared list name" value={listTitle} onChange={(e) => setListTitle(e.target.value)} placeholder="Same course or exam? e.g. Biology finals" maxLength={80} />
            <Button type="submit" variant="outline" disabled={!listTitle.trim()}>Start</Button>
          </form>
        ) : lists.map((l) => !l.accepted ? (
          l.mine ? <p key={l.id} className="text-xs text-muted-foreground">Waiting for {name} to join “{l.title}”.</p>
            : <Button key={l.id} size="sm" variant="outline" onClick={() => run(() => acceptSharedList(l.id), 'Joined.')}>Join “{l.title}”</Button>
        ) : (
          <div key={l.id} className="space-y-2">
            <ul className="max-h-32 divide-y overflow-y-auto rounded-xl border">
              {l.items.map((i) => (
                <li key={i.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <button aria-label={i.done ? `Undo ${i.title}` : `Done: ${i.title}`} onClick={() => run(() => toggleSharedItem(i.id, !i.done))}
                    className={`flex size-4 items-center justify-center rounded border ${i.done ? 'border-primary bg-accent' : ''}`}>{i.done && <Check className="size-3" />}</button>
                  <span className={i.done ? 'text-muted-foreground line-through' : ''}>{i.title}</span>
                </li>
              ))}
              {l.items.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No items yet.</li>}
            </ul>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await addSharedItem(l.id, item); if (r.ok) setItem(''); return r }) }}>
              <Input aria-label={`Add to ${l.title}`} value={item} onChange={(e) => setItem(e.target.value)} placeholder="Add an item" />
              <Button type="submit" variant="outline" disabled={!item.trim()}><Plus className="size-4" /></Button>
            </form>
          </div>
        ))}
      </div>

      <button disabled={pending} className="px-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => confirm(`Remove ${name} as a friend? Sharing stops immediately.`) && run(() => removeFriend(f.user_id), `${name} removed.`)}>
        Remove friend — stops all sharing instantly
      </button>
    </section>
  )
}

function SharingSettings({ me, run, pending }: { me: FriendsState['me']; run: Run; pending: boolean }) {
  const [level, setLevel] = useState<ShareLevel>(me.shareLevel)
  const [presence, setPresence] = useState(me.presenceVisible)
  const [invites, setInvites] = useState(me.invitesMode)
  const [callLink, setCallLink] = useState(me.callLink ?? '')
  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-1.5">
        <span>New friends see</span>
        <Chips label="Default sharing level" size="sm" value={level} onChange={setLevel} options={[...LEVELS]} />
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={presence} onChange={(e) => setPresence(e.target.checked)} /> Show when I’m online or in focus</label>
      <div className="space-y-1.5">
        <span>Session invites</span>
        <Chips label="Session invites" size="sm" value={invites} onChange={setInvites} options={[
          { value: 'allowed', label: 'Allowed', hint: 'Held while I focus' }, { value: 'online_only', label: 'Only when I’m online' }, { value: 'off', label: 'Off' },
        ]} />
      </div>
      <label className="block space-y-1">
        <span>Your call link (Meet, WhatsApp, Jitsi) — used if the in-app call can’t connect</span>
        <Input value={callLink} onChange={(e) => setCallLink(e.target.value)} placeholder="https://meet.google.com/…" />
      </label>
      <Button disabled={pending} onClick={() => run(() => updateSharing({ shareLevel: level, presenceVisible: presence, invitesMode: invites, callLink }), 'Saved.')}>Save</Button>
    </div>
  )
}
