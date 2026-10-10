'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy, Link2, RefreshCw, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cancelPartnerRequest, createInviteLink, regeneratePartnerCode, requestPartner, respondPartnerRequest } from '@/app/actions/partner'

type Req = { id: string; username: string; displayName: string | null }

/** Two ways to add a friend: your friend code (like a game player tag) or an invite link. No forms beyond that. */
export function ConnectPartner({ code, incoming, outgoing, compact = false }: { code: string; incoming: Req[]; outgoing: Req[]; compact?: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [their, setTheir] = useState('')
  const [link, setLink] = useState<string | null>(null)

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copied.`) } catch { toast(text) }
  }
  const share = async (text: string) => {
    if (navigator.share) { try { await navigator.share({ text }) } catch { /* cancelled */ } } else await copy(text, 'Message')
  }
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) toast(r.error ?? 'Something went wrong.')
      else if (msg) toast.success(msg)
      router.refresh()
    })

  return (
    <div className="space-y-4">
      {incoming.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-accent/40 p-4 text-sm">
          <span className="flex-1"><b>@{r.username}</b>{r.displayName ? ` (${r.displayName})` : ''} wants to be study friends.</span>
          <Button size="sm" disabled={pending} onClick={() => run(() => respondPartnerRequest(r.id, 'accept'), 'You’re now study friends!')}>Accept</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => respondPartnerRequest(r.id, 'decline'))}>Decline</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => respondPartnerRequest(r.id, 'block'), 'Blocked.')}>Block</Button>
        </div>
      ))}

      {!compact && <section className="space-y-3 rounded-2xl bg-card shadow-soft p-5">
        <p className="text-sm text-muted-foreground">Your friend code</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-2xl font-extrabold tracking-wider" data-testid="partner-code">{code}</span>
          <Button variant="outline" size="sm" onClick={() => copy(code, 'Code')}><Copy className="size-3.5" /> Copy</Button>
          <Button variant="outline" size="sm" onClick={() => share(`Study with me on Plan — my friend code is ${code}`)}><Share2 className="size-3.5" /> Share</Button>
          <button className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" disabled={pending}
            onClick={() => confirm('Make a new code? The old one will stop working.') && run(() => regeneratePartnerCode(), 'New code ready.')}>
            <RefreshCw className="size-3" /> New code
          </button>
        </div>
      </section>}

      <section className="space-y-2 rounded-2xl bg-card shadow-soft p-5">
        <label htmlFor="their-code" className="text-sm font-medium">Add a friend by their code</label>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await requestPartner(their); if (r.ok) { setTheir(''); toast.success(r.message) } return r }) }}>
          <Input id="their-code" value={their} onChange={(e) => setTheir(e.target.value)} placeholder="PLN-7K3Q9" className="font-mono uppercase" maxLength={12} />
          <Button type="submit" disabled={pending || their.trim().length < 5}>Send request</Button>
        </form>
        {outgoing.length > 0 && (
          <ul className="space-y-1 pt-1 text-sm text-muted-foreground">
            {outgoing.map((r) => (
              <li key={r.id} className="flex items-center justify-between">
                <span>Waiting for @{r.username}…</span>
                <button className="text-xs hover:text-foreground" onClick={() => run(() => cancelPartnerRequest(r.id))}>Cancel</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 rounded-2xl bg-card shadow-soft p-5">
        <p className="text-sm font-medium">Friend not on Plan yet?</p>
        <p className="text-xs text-muted-foreground">Send an invite link. It works once and expires in 7 days.</p>
        {link ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1 text-xs">{link}</code>
            <Button variant="outline" size="sm" onClick={() => copy(link, 'Link')}><Copy className="size-3.5" /> Copy</Button>
            <Button variant="outline" size="sm" onClick={() => share(`Let’s keep each other on track — join me on Plan: ${link}`)}><Share2 className="size-3.5" /> Share</Button>
          </div>
        ) : (
          <Button variant="outline" disabled={pending} onClick={() => start(async () => {
            const r = await createInviteLink()
            if (!r.ok) return void toast(r.error)
            setLink(r.url)
          })}><Link2 className="size-4" /> Create invite link</Button>
        )}
      </section>
    </div>
  )
}
