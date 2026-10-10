'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { setWorkMode } from '@/app/actions/partner'
import { InviteDialog, type InviteFriend } from './invite-dialog'

/** Once a day, only when you have friends: "Solo or together today?" — one tap, remembered. */
export function DailyMode({ friends }: { friends: InviteFriend[] }) {
  const [gone, setGone] = useState(false)
  const [invite, setInvite] = useState(false)
  const [pending, start] = useTransition()
  const online = friends.filter((f) => f.online)
  const choose = (mode: 'solo' | 'pair') =>
    start(async () => {
      await setWorkMode(mode)
      if (mode === 'pair') setInvite(true)
      else setGone(true)
    })
  return (
    <>
      {!gone && (
        <section aria-label="How do you want to work today?" className="flex flex-wrap items-center gap-2 rounded-2xl bg-card/70 shadow-soft px-4 py-3 text-sm">
          <span className="flex-1">How do you want to work today?</span>
          <button disabled={pending} onClick={() => choose('solo')} className="h-8 rounded-lg border px-3 hover:bg-muted">Solo</button>
          <button disabled={pending} onClick={() => choose('pair')} className="h-8 rounded-lg border px-3 hover:bg-muted">
            With friends{online.length ? ` · ${online.length} online` : ''}
          </button>
        </section>
      )}
      <InviteDialog open={invite} onOpenChange={(o) => { setInvite(o); if (!o) setGone(true) }} friends={friends}
        initial={online[0] ? [online[0].id] : undefined} />
    </>
  )
}

/** Compact friends line for Home (phones have no sidebar). */
export function PartnerLine({ friends }: { friends: InviteFriend[] }) {
  const [invite, setInvite] = useState(false)
  const online = friends.filter((f) => f.online)
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground md:hidden">
      <Link href="/partner" className="min-w-0 flex-1 truncate hover:text-foreground">
        👥 {online.length ? `${online.map((f) => f.name).slice(0, 2).join(', ')}${online.length > 2 ? ` +${online.length - 2}` : ''} online` : `${friends.length} friend${friends.length === 1 ? '' : 's'}`}
      </Link>
      <button onClick={() => setInvite(true)} className="text-primary hover:underline">Invite</button>
      <InviteDialog open={invite} onOpenChange={setInvite} friends={friends} initial={online[0] ? [online[0].id] : undefined} />
    </div>
  )
}
