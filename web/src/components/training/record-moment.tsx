'use client'

import { useState, useTransition } from 'react'
import { Trophy } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { markRecordsSeen } from '@/app/actions/training'
import { RECORDS, type RecordType } from '@/domain/training/records'
import { say, type Tone } from '@/domain/guide/copy'

/** Full-screen moment — reserved for personal records (DESIGN §10.11 celebration scaling). */
export function RecordMoment({ records, tone }: { records: { type: RecordType; value: number; previous: number | null }[]; tone: Tone }) {
  const [open, setOpen] = useState(records.length > 0)
  const [, start] = useTransition()
  const close = () => {
    setOpen(false)
    start(() => void markRecordsSeen())
  }
  if (!records.length) return null
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="text-center sm:max-w-sm">
        <Trophy className="mx-auto size-10 animate-settle text-primary" />
        <DialogTitle className="text-xl">{records.length > 1 ? 'New personal records' : 'New personal record'}</DialogTitle>
        <DialogDescription className="sr-only">Personal records you just broke</DialogDescription>
        <ul className="space-y-2">
          {records.map((r) => {
            const d = RECORDS[r.type]
            return (
              <li key={r.type} className="rounded-xl bg-muted px-3 py-2">
                <p className="text-sm text-muted-foreground">{d.label}</p>
                <p className="text-lg font-semibold tabular">{d.fmt(r.value)}</p>
                {r.previous !== null && <p className="text-xs text-muted-foreground">Previous best {d.fmt(r.previous)}</p>}
              </li>
            )
          })}
        </ul>
        {records[0]!.type === 'longest_clean_session' && <p className="text-sm text-muted-foreground">{say(tone, 'pr', { n: Math.round(records[0]!.value) })}</p>}
        <Button className="w-full" onClick={close}>Nice</Button>
      </DialogContent>
    </Dialog>
  )
}
