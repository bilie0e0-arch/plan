'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Chips } from '@/components/ui/choice'
import { Kbd } from '@/components/ui/kbd'
import { useStepKeys } from '@/lib/client/use-step-keys'
import { saveCallChoice, loadCallChoice, type CallChoice } from '@/lib/client/partner-feed'
import { sendSessionInvite } from '@/app/actions/partner'

export interface InviteFriend { id: string; name: string; online?: boolean }

const CALLS = [
  { value: 'video', label: '📹 Video' }, { value: 'audio', label: '🎧 Audio' }, { value: 'none', label: '🤫 No call' },
] as const

/** "Focus together": pick 1–4 friends, a length and the call type — prefilled, so Enter sends. */
export function InviteDialog({ open, onOpenChange, friends, initial }: {
  open: boolean; onOpenChange: (o: boolean) => void; friends: InviteFriend[]; initial?: string[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && <InviteForm friends={friends} initial={initial} close={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function InviteForm({ friends, initial, close }: { friends: InviteFriend[]; initial?: string[]; close: () => void }) {
  const router = useRouter()
  const [picked, setPicked] = useState<string[]>(() => {
    const first = initial?.filter((id) => friends.some((f) => f.id === id)) ?? []
    return first.length ? first.slice(0, 4) : friends[0] ? [friends[0].id] : []
  })
  const [minutes, setMinutes] = useState(50)
  const [call, setCall] = useState<CallChoice>(() => loadCallChoice() ?? 'none')
  const [pending, start] = useTransition()
  const names = friends.filter((f) => picked.includes(f.id)).map((f) => f.name)

  const toggle = (id: string) => setPicked((p) => {
    if (p.includes(id)) return p.length > 1 ? p.filter((x) => x !== id) : p
    if (p.length >= 4) { toast('Up to 4 friends at a time.'); return p }
    return [...p, id]
  })
  const send = () => {
    if (!picked.length || pending) return
    start(async () => {
      saveCallChoice(call)
      const r = await sendSessionInvite(minutes, picked, call)
      if (!r.ok) return void toast(r.error)
      close()
      if (r.status === 'joined' && r.coSessionId) {
        toast.success(`${names[0]} had already invited you — joining.`)
        router.push(`/pair/${r.coSessionId}`)
      } else toast.success(`Invite sent to ${names.length > 1 ? `${names.length} friends` : names[0]}.`)
    })
  }
  useStepKeys({ onNext: send })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Focus together</DialogTitle>
        <DialogDescription>They get a small card. If they’re mid-session, it waits until they finish.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div role="group" aria-label="Friends" className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {friends.map((f) => {
            const on = picked.includes(f.id)
            return (
              <button key={f.id} type="button" aria-pressed={on} onClick={() => toggle(f.id)}
                className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-bold transition-colors duration-150 ${on ? 'border-primary bg-accent text-accent-foreground' : 'border-transparent bg-muted text-muted-foreground hover:text-foreground'}`}>
                {f.online && <span aria-hidden className="size-2 rounded-full bg-success" />}{f.name}{on && <span aria-hidden>✓</span>}
              </button>
            )
          })}
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-muted-foreground">For how long</p>
          <Chips label="Length" value={minutes} onChange={setMinutes} options={[25, 50, 90].map((m) => ({ value: m, label: `${m} min` }))} />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-muted-foreground">Call — the same for everyone</p>
          <Chips label="Call" value={call} onChange={setCall} options={[...CALLS]} />
          <p className="text-xs text-muted-foreground">
            {call === 'none' ? 'Just the shared clock — like a quiet library table.'
              : `Mics mute while you focus; talk during check-in and breaks.${picked.length > 1 ? ` Group call with ${picked.length + 1} people.` : ''}`}
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button disabled={pending || !picked.length} onClick={send} className="w-full sm:w-auto">
          Send invite{picked.length > 1 ? ` to ${picked.length} friends` : ''} <Kbd>Enter ↵</Kbd>
        </Button>
      </DialogFooter>
    </>
  )
}
