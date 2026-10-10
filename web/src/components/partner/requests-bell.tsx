'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Bell } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { acceptSharedList, respondPartnerRequest, respondSessionInvite } from '@/app/actions/partner'
import { CALL_LABEL, markReactionsSeen, nameOf, saveResume, type FeedState, type FriendLite } from '@/lib/client/partner-feed'

const REACTION: Record<string, string> = { clap: '👏', strong: '💪', nudge: '🤝 Rooting for you' }

/** Requests bell — friend requests, session invites, reactions, common-list invites. Kept apart from the task Inbox. */
export function RequestsBell({ feed, friends, refresh, className = '' }: { feed: FeedState; friends: FriendLite[]; refresh: () => void; className?: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const invites = feed.invites
  const count = feed.requests.length + invites.length + feed.reactions.length + feed.listInvites.length
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string, after?: () => void) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) toast(r.error ?? 'Something went wrong.')
      else { if (msg) toast.success(msg); after?.() }
      refresh()
      router.refresh()
    })

  return (
    <DropdownMenu onOpenChange={(o) => { if (o && feed.reactions.length) void markReactionsSeen(feed.reactions.map((r) => r.id)).then(refresh) }}>
      <DropdownMenuTrigger aria-label={count ? `Requests (${count} new)` : 'Requests'} className={`relative rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground ${className}`}>
        <Bell className="size-4" />
        {count > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-primary" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        {count === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Nothing new.</p>}
        <div className={`space-y-2 ${pending ? 'opacity-60' : ''}`}>
          {feed.requests.map((r) => (
            <div key={r.id} className="space-y-2 rounded-lg border p-2.5 text-sm">
              <p><b>@{r.username}</b>{r.displayName ? ` (${r.displayName})` : ''} wants to be study friends.</p>
              <div className="flex gap-1.5">
                <button className="h-7 rounded-md border px-2.5 text-xs font-medium hover:bg-muted" onClick={() => act(() => respondPartnerRequest(r.id, 'accept'), 'You’re now study friends!')}>Accept</button>
                <button className="h-7 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-muted" onClick={() => act(() => respondPartnerRequest(r.id, 'decline'))}>Decline</button>
                <button className="ml-auto h-7 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-muted" onClick={() => act(() => respondPartnerRequest(r.id, 'block'), 'Blocked.')}>Block</button>
              </div>
            </div>
          ))}
          {invites.map((i) => (
            <div key={i.id} className="space-y-2 rounded-lg border p-2.5 text-sm">
              <p>{nameOf(friends, i.from_user)}{i.party > 1 ? ` + ${i.party - 1} other${i.party > 2 ? 's' : ''}` : ''}: focus together for {i.minutes} min{CALL_LABEL[i.call_mode] ?? ''}?{i.status === 'later' && <span className="text-muted-foreground"> (you said later)</span>}</p>
              <div className="flex flex-wrap gap-1.5">
                <button className="h-7 rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
                  onClick={() => start(async () => {
                    const r = await respondSessionInvite(i.id, 'accept')
                    if (!r.ok) { toast(r.error); refresh(); return }
                    saveResume(r.resume)
                    if (r.coSessionId) router.push(`/pair/${r.coSessionId}`)
                  })}>Join now</button>
                <button className="h-7 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-muted" onClick={() => act(() => respondSessionInvite(i.id, 'snooze'), 'Told them: in 10 min.')}>In 10 min</button>
                <button className="h-7 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-muted" onClick={() => act(() => respondSessionInvite(i.id, 'decline'))}>Not today</button>
              </div>
            </div>
          ))}
          {feed.listInvites.map((l) => (
            <div key={l.id} className="space-y-2 rounded-lg border p-2.5 text-sm">
              <p>{nameOf(friends, l.created_by)} started a shared list: <b>{l.title}</b></p>
              <button className="h-7 rounded-md border px-2.5 text-xs font-medium hover:bg-muted" onClick={() => act(() => acceptSharedList(l.id), 'Joined the list.')}>Join list</button>
            </div>
          ))}
          {feed.reactions.map((r) => (
            <p key={r.id} className="rounded-lg bg-muted/60 px-2.5 py-2 text-sm">{REACTION[r.kind] ?? '👏'} from {nameOf(friends, r.from_user)}</p>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
