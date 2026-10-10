'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Users, X } from 'lucide-react'
import { respondSessionInvite } from '@/app/actions/partner'
import { CALL_LABEL, markRepliesSeen, nameOf, saveResume, type FeedState, type FriendLite } from '@/lib/client/partner-feed'

const REPLY: Record<string, (n: string) => string> = {
  snoozed: (n) => `${n}: joining in 10 min.`,
  later: (n) => `${n} will get back to you.`,
  declined: () => 'Not today 🙂',
}

/** Shows an incoming "focus together" invite as a small card (never a full-screen popup) and handles replies to yours. */
export function PartnerHub({ feed, friends, refresh }: { feed: FeedState; friends: FriendLite[]; refresh: () => void }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const handled = useRef(new Set<string>())

  // Replies to invites you sent: accepted → open the room after 3 s (cancellable); others → a short note.
  useEffect(() => {
    const fresh = feed.replies.filter((r) => !handled.current.has(r.id))
    if (!fresh.length) return
    fresh.forEach((r) => handled.current.add(r.id))
    void markRepliesSeen(fresh.map((r) => r.id))
    const opened = new Set<string>()
    for (const r of fresh) {
      const who = nameOf(friends, r.to_user)
      if (r.status === 'accepted' && r.co_session_id) {
        // A group invite: the first friend to accept opens the room; later ones simply join it.
        if (opened.has(r.co_session_id) || location.pathname.startsWith('/pair/')) continue
        opened.add(r.co_session_id)
        let cancelled = false
        toast.success(`${who} joined — opening the room`, { action: { label: 'Cancel', onClick: () => { cancelled = true } }, duration: 3000 })
        setTimeout(() => { if (!cancelled) router.push(`/pair/${r.co_session_id}`) }, 3000)
      } else if (REPLY[r.status]) toast(REPLY[r.status]!(who))
    }
  }, [feed.replies, friends, router])

  const now = Date.now()
  const invite = feed.invites.find((i) => !dismissed.has(i.id) && (i.status === 'pending' || (i.status === 'snoozed' && i.snooze_until && new Date(i.snooze_until).getTime() <= now)))
  if (!invite) return null
  const from = nameOf(friends, invite.from_user)
  const others = invite.party - 1
  const ago = Math.max(0, Math.round((now - new Date(invite.created_at).getTime()) / 60_000))

  const respond = (action: 'accept' | 'snooze' | 'later' | 'decline') =>
    start(async () => {
      const r = await respondSessionInvite(invite.id, action)
      if (!r.ok) { toast(r.error); refresh(); return }
      setDismissed((d) => new Set(d).add(invite.id))
      if (action === 'accept' && r.coSessionId) {
        saveResume(r.resume)
        router.push(`/pair/${r.coSessionId}`)
      } else refresh()
    })

  return (
    <div role="dialog" aria-label="Session invite" className="fixed bottom-24 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] animate-in slide-in-from-bottom-4 fade-in rounded-2xl border bg-popover p-4 shadow-lg md:bottom-6">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"><Users className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{from}{others > 0 ? ` + ${others} other${others > 1 ? 's' : ''}` : ''}: focus together for {invite.minutes} min{CALL_LABEL[invite.call_mode] ?? ''}?</p>
          {ago >= 2 && <p className="text-xs text-muted-foreground">Sent {ago} min ago — still on?</p>}
        </div>
        <button aria-label="Hide" className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => setDismissed((d) => new Set(d).add(invite.id))}><X className="size-4" /></button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <button disabled={pending} onClick={() => respond('accept')} className="col-span-2 h-9 rounded-lg bg-primary font-medium text-primary-foreground hover:bg-primary/80">Join now</button>
        <button disabled={pending} onClick={() => respond('snooze')} className="h-8 rounded-lg border hover:bg-muted">In 10 min</button>
        <button disabled={pending} onClick={() => respond('later')} className="h-8 rounded-lg border hover:bg-muted">Later</button>
        <button disabled={pending} onClick={() => respond('decline')} className="col-span-2 h-7 text-xs text-muted-foreground hover:text-foreground">Not today</button>
      </div>
    </div>
  )
}
