'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Choice, NumberStepper } from '@/components/ui/choice'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cancelBlock, commitBlock, updateBlock } from '@/app/actions/calendar'
import { useTaskMutation } from '@/components/tasks/task-actions'
import { localDayMinute } from '@/domain/time/day'
import { fmtMinutes } from '@/lib/format'
import type { BlockView } from '@/lib/data/calendar'

export function EditBlockDialog({ block, timeZone, nowMs, projects, onClose }: {
  block: BlockView; timeZone: string; nowMs: number; projects: { id: string; name: string; color: string }[]; onClose: () => void
}) {
  const start = localDayMinute(new Date(block.start), timeZone)
  const dur = Math.round((new Date(block.end).getTime() - new Date(block.start).getTime()) / 60_000)
  const [minutes, setMinutes] = useState(dur)
  const [projectId, setProjectId] = useState(block.subject?.id ?? '')
  const changed = minutes !== dur || projectId !== (block.subject?.id ?? '')
  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const { pending, run } = useTaskMutation()
  const router = useRouter()
  const startsIn = (new Date(block.start).getTime() - nowMs) / 60_000
  const canRelease = startsIn >= 120
  const live = startsIn <= 10 && new Date(block.end).getTime() > nowMs
  const final = !!block.outcome
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{block.title}</DialogTitle>
          <DialogDescription>
            {fmtDay(start.key)} {fmtTime(start.minute)} · {fmtMinutes(dur)} · {block.status}{block.outcome ? ` · ${block.outcome}` : ''}
          </DialogDescription>
        </DialogHeader>
        {block.ifThen && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{block.ifThen}</p>}
        {!final && !cancelling && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              Duration
              <NumberStepper label="minutes" value={minutes} onChange={setMinutes} min={15} max={240} step={15} unit="min" />
            </div>
            {projects.length > 0 && (
              <div className="space-y-1 text-sm"><span className="text-muted-foreground">Subject</span>
                <Choice label="Subject" size="sm" value={projectId} onChange={setProjectId}
                  options={[{ value: '', label: 'None', dot: null }, ...projects.map((p) => ({ value: p.id, label: p.name, dot: p.color }))]} /></div>
            )}
            <p className="text-xs text-muted-foreground">Tip: drag the block to move it, or drag its bottom edge to make it longer.</p>
            {block.status === 'committed' && <p className="text-xs text-muted-foreground">Committed: changes are recorded as revisions; the original stays on file.</p>}
          </div>
        )}
        {cancelling && (
          <div className="space-y-2">
            <Input autoFocus placeholder="Reason (e.g. client call moved)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              {block.status !== 'committed' ? 'Not committed — it will simply be removed.'
                : canRelease ? 'Releasing early with a reason is a good decision, not a miss.'
                  : 'Less than 2 hours before start — this will count as missed. Moving it may be better.'}
            </p>
          </div>
        )}
        <DialogFooter className="flex-wrap gap-2">
          {!final && live && <Button onClick={() => router.push(block.type === 'speaking' ? `/speak/drill?block=${block.id}` : `/launch/${block.id}`)}>Start now</Button>}
          {!final && !cancelling && changed && (
            <Button disabled={pending} onClick={() => run(async () => {
              const r = await updateBlock({ id: block.id, start: block.start, minutes, projectId: projectId || null })
              if (r.ok) onClose()
              return r
            }, 'Saved.')}>Save</Button>
          )}
          {!final && !cancelling && block.status === 'planned' && block.type !== 'buffer' && (
            <Button variant="outline" disabled={pending} onClick={() => run(async () => { const r = await commitBlock(block.id); if (r.ok) onClose(); return r }, 'Committed.')}>Commit</Button>
          )}
          {!final && !cancelling && <Button variant="ghost" onClick={() => setCancelling(true)}>{block.status === 'committed' ? 'Release…' : 'Remove'}</Button>}
          {cancelling && (
            <>
              <Button variant="ghost" onClick={() => setCancelling(false)}>Back</Button>
              <Button disabled={pending} onClick={() => run(async () => {
                const r = await cancelBlock({ id: block.id, reason: reason || null })
                if (r.ok) onClose()
                return r
              }, block.status === 'committed' && canRelease && reason ? 'Released. Good call.' : 'Removed.')}>
                {block.status === 'committed' ? 'Release block' : 'Remove'}
              </Button>
              {block.seriesId && (
                <Button variant="ghost" disabled={pending} onClick={() => run(async () => {
                  const r = await cancelBlock({ id: block.id, reason: reason || null, deleteSeries: true })
                  if (r.ok) onClose()
                  return r
                }, 'Series stopped.')}>Stop repeating</Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function fmtTime(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}
export function fmtDay(key: string) {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
}
