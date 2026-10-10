'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Choice, Chips } from '@/components/ui/choice'
import { deleteTask, editTask, hideTask, moveTask } from '@/app/actions/tasks'
import { setTaskPrivate } from '@/app/actions/partner'

export interface TaskLite {
  id: string
  title: string
  firstAction: string | null
  status: string
  estimate: number | null
  energy: 'deep' | 'shallow' | 'admin' | null
  projectId: string | null
  doneWhen?: string | null
  ifThenTrigger?: string | null
  ifThenMinute?: number | null
  hiddenUntil?: string | null
  shareOverride?: string | null
}
export interface ProjectOption { id: string; name: string; color: string }

type Dest = 'today' | 'evening' | 'backlog' | 'someday' | 'inbox' | 'killed'

/** Local calendar day `n` days from now (the server re-checks against the user's own day). */
function localDay(n: number): string {
  return new Intl.DateTimeFormat('en-CA').format(new Date(Date.now() + n * 86_400_000))
}

/** Shared mutation helper: runs a server action, toasts errors, refreshes. */
export function useTaskMutation() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) toast(r.error ?? 'Something went wrong.')
      else if (success) toast.success(success)
      router.refresh()
    })
  return { pending, run }
}

/**
 * First-action gate (DESIGN F9): a task can't enter Today without a concrete first physical step.
 */
export function PlanGateDialog({
  task, to, open, onOpenChange,
}: { task: TaskLite; to: 'today' | 'evening'; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [value, setValue] = useState(task.firstAction ?? task.title)
  const { pending, run } = useTaskMutation()
  const submit = () =>
    run(async () => {
      const r = await moveTask({ id: task.id, to, firstAction: value })
      if (r.ok) onOpenChange(false)
      return r
    }, to === 'evening' ? 'Added to this evening.' : 'Added to Today.')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What’s the first physical step?</DialogTitle>
          <DialogDescription>Concrete steps get started. “Open chapter 4 at page 82” beats “Study”.</DialogDescription>
        </DialogHeader>
        <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && value.trim() && submit()} placeholder="Open… / Write… / Call…" />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!value.trim() || pending} onClick={submit}>Plan it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EditTaskDialog({
  task, projects, open, onOpenChange,
}: { task: TaskLite; projects: ProjectOption[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [title, setTitle] = useState(task.title)
  const [firstAction, setFirstAction] = useState(task.firstAction ?? '')
  const [estimate, setEstimate] = useState(task.estimate ? String(task.estimate) : '')
  const [energy, setEnergy] = useState<string>(task.energy ?? '')
  const [projectId, setProjectId] = useState(task.projectId ?? '')
  const [doneWhen, setDoneWhen] = useState(task.doneWhen ?? '')
  const [cue, setCue] = useState(task.ifThenTrigger ?? '')
  const [cueTime, setCueTime] = useState(task.ifThenMinute != null ? `${String(Math.floor(task.ifThenMinute / 60)).padStart(2, '0')}:${String(task.ifThenMinute % 60).padStart(2, '0')}` : '')
  const { pending, run } = useTaskMutation()
  const save = () =>
    run(async () => {
      const r = await editTask({
        id: task.id, title, firstAction: firstAction || null,
        estimate: estimate ? Number(estimate) : null,
        energy: (energy || null) as TaskLite['energy'],
        projectId: projectId || null,
        doneWhen: doneWhen.trim() || null,
        ifThenTrigger: cue.trim() || null,
        ifThenMinute: cueTime ? Number(cueTime.slice(0, 2)) * 60 + Number(cueTime.slice(3, 5)) : null,
      })
      if (r.ok) onOpenChange(false)
      return r
    }, 'Saved.')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit task</DialogTitle><DialogDescription className="sr-only">Edit task details</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="t-title">Title</Label><Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="t-first">First physical step</Label><Input id="t-first" value={firstAction} onChange={(e) => setFirstAction(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="t-done">Done when…</Label>
            <Input id="t-done" value={doneWhen} maxLength={200} placeholder="e.g. draft sent to Sam" onChange={(e) => setDoneWhen(e.target.value)} /></div>
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <div className="space-y-1"><Label htmlFor="t-cue">If-then cue</Label>
              <Input id="t-cue" value={cue} maxLength={200} placeholder="If I finish lunch, I open the draft" onChange={(e) => setCue(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="t-cue-time">At (optional)</Label>
              <Input id="t-cue-time" type="time" value={cueTime} onChange={(e) => setCueTime(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-[6rem_1fr] items-end gap-2">
            <div className="space-y-1"><Label htmlFor="t-est">Estimate (min)</Label>
              <Input id="t-est" inputMode="numeric" value={estimate} onChange={(e) => setEstimate(e.target.value.replace(/\D/g, ''))} /></div>
            <Chips label="Quick estimate" size="sm" value={estimate} onChange={setEstimate}
              options={['15', '25', '45', '60', '90'].map((m) => ({ value: m, label: `${m}m` }))} />
          </div>
          <div className="space-y-1"><p className="text-sm font-medium">Energy</p>
            <Chips label="Energy" size="sm" value={energy} onChange={setEnergy}
              options={[{ value: '', label: 'Any' }, { value: 'deep', label: 'Deep', emoji: '🧠' }, { value: 'shallow', label: 'Light', emoji: '🌤️' }, { value: 'admin', label: 'Admin', emoji: '📋' }]} /></div>
          <div className="space-y-1"><p className="text-sm font-medium">Project</p>
            <Choice label="Project" size="sm" value={projectId} onChange={setProjectId}
              options={[{ value: '', label: 'No project', dot: null }, ...projects.map((p) => ({ value: p.id, label: p.name, dot: p.color }))]} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={pending || !title.trim()} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Overflow menu: move between lists, edit, drop. Today/Evening go through the first-action gate. */
export function TaskMenu({ task, projects }: { task: TaskLite; projects: ProjectOption[] }) {
  const [gate, setGate] = useState<null | 'today' | 'evening'>(null)
  const [edit, setEdit] = useState(false)
  const [hidePick, setHidePick] = useState(false)
  const { run } = useTaskMutation()
  const move = (to: Dest, msg: string) => {
    run(() => moveTask({ id: task.id, to }), msg)
  }
    return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Task options" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {task.status !== 'today' && <DropdownMenuItem onClick={() => move('today', 'Added to Today ☀️')}>☀️ Move to Today</DropdownMenuItem>}
          {task.status !== 'evening' && <DropdownMenuItem onClick={() => move('evening', 'Added to this evening 🌙')}>🌙 This evening</DropdownMenuItem>}
          {task.status !== 'backlog' && <DropdownMenuItem onClick={() => move('backlog', 'Moved to Soon.')}>⏳ Soon (not today)</DropdownMenuItem>}
          {task.status !== 'someday' && <DropdownMenuItem onClick={() => move('someday', 'Parked in Someday 🌙')}>🌙 Someday</DropdownMenuItem>}
          <DropdownMenuItem onClick={() => setEdit(true)}>✏️ Edit…</DropdownMenuItem>
          <DropdownMenuSeparator />
          {task.hiddenUntil ? (
            <DropdownMenuItem onClick={() => run(() => hideTask(task.id, null), 'Showing it again.')}>Show now</DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onClick={() => run(() => hideTask(task.id, localDay(1)), 'Hidden until tomorrow.')}>Hide until tomorrow</DropdownMenuItem>
              <DropdownMenuItem onClick={() => run(() => hideTask(task.id, localDay(((8 - new Date().getDay()) % 7) || 7)), 'Hidden until Monday.')}>Hide until Monday</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHidePick(true)}>Hide until…</DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={() => run(() => setTaskPrivate(task.id, task.shareOverride !== 'private'), task.shareOverride === 'private' ? 'Shared with your friends again.' : 'Hidden from your friends.')}>
            {task.shareOverride === 'private' ? 'Share with friends' : 'Hide from friends'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => move('killed', 'Let go. That’s a decision, not a failure.')}>👋 Let it go</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => run(() => deleteTask(task.id), 'Deleted.')}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {gate && <PlanGateDialog task={task} to={gate} open onOpenChange={(o) => !o && setGate(null)} />}
      {edit && <EditTaskDialog task={task} projects={projects} open onOpenChange={setEdit} />}
      {hidePick && <HideUntilDialog task={task} open onOpenChange={setHidePick} />}
    </>
  )
}

/** "Hide until…" (Things-style start date): out of every list until that day, then back where it was. */
function HideUntilDialog({ task, open, onOpenChange }: { task: TaskLite; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [min] = useState(() => localDay(1))
  const [day, setDay] = useState(min)
  const { pending, run } = useTaskMutation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Hide until…</DialogTitle>
          <DialogDescription>It leaves your lists and comes back on this day.</DialogDescription>
        </DialogHeader>
        <Input type="date" aria-label="Show again on" min={min} value={day} onChange={(e) => setDay(e.target.value)} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={pending || !day} onClick={() => run(async () => {
            const r = await hideTask(task.id, day)
            if (r.ok) onOpenChange(false)
            return r
          }, 'Hidden until then.')}>Hide</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
