'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { setWorkMode } from '@/app/actions/partner'
import { presenceStatus, type FeedState, type FriendLite } from '@/lib/client/partner-feed'
import { InviteDialog } from './invite-dialog'

export const STATUS_LABEL = { online: 'Online', focus: 'In focus', break: 'On a break', offline: 'Away' } as const
export const STATUS_DOT = { online: 'bg-success', focus: 'bg-primary', break: 'bg-warning', offline: 'border border-muted-foreground/50' } as const
export type Status = keyof typeof STATUS_LABEL
const RANK: Record<Status, number> = { focus: 0, break: 1, online: 2, offline: 3 }

/** Live status of every friend: focusing first, then on a break, online, away. */
export function useFriendStatuses<F extends FriendLite>(friends: F[], feed: FeedState) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])
  return friends.map((f) => {
    const p = feed.presence[f.id]
    const status = (presenceStatus(p, now) ?? 'offline') as Status
    const left = status === 'focus' && p?.focus_until ? Math.max(0, Math.round((new Date(p.focus_until).getTime() - now) / 60_000)) : null
    return { ...f, status, left, online: status !== 'offline' }
  }).sort((a, b) => RANK[a.status] - RANK[b.status])
}

/** Solo · Together, always one tap away. With friends it also shows who is around and an Invite. */
export function WorkModeCard({ friends, feed, workMode }: { friends: FriendLite[]; feed: FeedState; workMode: 'solo' | 'pair' }) {
  const router = useRouter()
  const [invite, setInvite] = useState(false)
  const [mode, setMode] = useState(friends.length ? workMode : 'solo')
  const [, start] = useTransition()
  const list = useFriendStatuses(friends, feed)
  const around = list.filter((f) => f.online)
  const pick = (m: 'solo' | 'pair') => {
    if (m === 'pair' && !friends.length) return router.push('/partner')
    setMode(m)
    start(() => void setWorkMode(m))
    if (m === 'pair') setInvite(true)
  }
  return (
    <div className="space-y-2.5 rounded-2xl bg-card p-3 shadow-soft">
      <p className="text-xs font-bold text-muted-foreground">Work mode</p>
      <div className="flex rounded-full bg-muted p-1" role="group" aria-label="Work mode">
        {(['solo', 'pair'] as const).map((m) => (
          <button key={m} aria-pressed={mode === m} onClick={() => pick(m)}
            className={`flex-1 whitespace-nowrap rounded-full px-1.5 py-1.5 text-[13px] font-bold transition-all duration-150 ${mode === m ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground'}`}>
            {m === 'solo' ? '🙂 Solo' : '👥 Together'}
          </button>
        ))}
      </div>
      {friends.length ? (
        <div className="space-y-1.5 text-sm">
          {list.slice(0, 3).map((f) => (
            <Link key={f.id} href={`/partner?f=${f.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
              <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[f.status]}`} />
              <span className="min-w-0 flex-1 truncate font-bold">
                {f.name}
                <span className="font-semibold text-muted-foreground"> · {STATUS_LABEL[f.status]}{f.left !== null ? ` · ${f.left}m` : ''}</span>
              </span>
            </Link>
          ))}
          <div className="flex items-center gap-2 text-xs">
            <Link href="/partner" className="flex-1 text-muted-foreground hover:text-foreground">{around.length} of {friends.length} around</Link>
            <button onClick={() => setInvite(true)} className="font-bold text-primary hover:underline">Invite</button>
          </div>
        </div>
      ) : (
        <Link href="/partner" className="block text-xs font-bold text-primary hover:underline">Add a study friend →</Link>
      )}
      {friends.length > 0 && <InviteDialog open={invite} onOpenChange={setInvite} friends={list} initial={around[0] ? [around[0].id] : undefined} />}
    </div>
  )
}
