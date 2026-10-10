'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { updateBlock } from '@/app/actions/calendar'

export interface ReflowPreview { id: string; title: string; from: string; to: string | null; minutes: number }

/** Re-flow the rest of today: rules propose, you see every change, you confirm. Nothing moves on its own. */
export function ReflowButton({ moves, timeZone, autoOpen }: { moves: ReflowPreview[]; timeZone: string; autoOpen: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen && moves.length > 0)
  const [pending, start] = useTransition()
  if (!moves.length) return null
  const t = (iso: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(new Date(iso))
  const placed = moves.filter((m) => m.to)

  const apply = () =>
    start(async () => {
      let ok = 0
      for (const m of placed) {
        const r = await updateBlock({ id: m.id, start: m.to!, minutes: m.minutes })
        if (r.ok) ok++
        else toast(`${m.title}: ${r.error}`)
      }
      if (ok) toast.success(`${ok} block${ok > 1 ? 's' : ''} moved. Changes are on record; the original plan stays.`)
      setOpen(false)
      router.replace('/calendar')
      router.refresh()
    })

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Shuffle className="size-4" /> Re-flow today ({moves.length})</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Re-flow the rest of today</DialogTitle>
            <DialogDescription>Slipped blocks move into the next free slots, in order. Everything else stays where it is.</DialogDescription>
          </DialogHeader>
          <ul className="divide-y rounded-xl border text-sm">
            {moves.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate">{m.title}</span>
                <span className="tabular text-muted-foreground">{t(m.from)} → {m.to ? <b className="text-foreground">{t(m.to)}</b> : 'doesn’t fit today'}</span>
              </li>
            ))}
          </ul>
          {moves.some((m) => !m.to) && <p className="text-xs text-muted-foreground">Blocks that don’t fit stay where they are — move them to another day or release them.</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Not now</Button>
            <Button disabled={pending || placed.length === 0} onClick={apply}>Move {placed.length} block{placed.length === 1 ? '' : 's'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
