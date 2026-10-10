'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command'
import { logout } from '@/app/(auth)/actions'
import { moveTask, searchTasks, type TaskHit } from '@/app/actions/tasks'
import { clearDevice } from '@/lib/client/sign-out'

/** Ctrl+K: go anywhere, and act on any task by typing its name (start it, put it on Today). */
export function CommandPalette({
  open, onOpenChange, onCapture, onWhatsLeft,
}: { open: boolean; onOpenChange: (o: boolean) => void; onCapture: () => void; onWhatsLeft: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<TaskHit[]>([])
  const run = (fn: () => void) => {
    setOpen(false)
    fn()
  }
  const go = (href: string) => run(() => router.push(href))

  const setOpen = (o: boolean) => {
    if (!o) { setQuery(''); setHits([]) }
    onOpenChange(o)
  }
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    let live = true
    const t = setTimeout(() => void searchTasks(q).then((h) => live && setHits(h)), 180)
    return () => { live = false; clearTimeout(t) }
  }, [query])

  const toToday = (t: TaskHit) => run(async () => {
    const r = await moveTask({ id: t.id, to: 'today' })
    if (!r.ok) toast(r.error)
    else toast.success('Added to Today.')
    router.refresh()
  })

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      {/* cmdk needs its <Command> root inside the dialog; without it, typing crashes the page. */}
      <Command>
      <CommandInput placeholder="Type a command or a task name…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No matching command or task.</CommandEmpty>
        {query.trim().length >= 2 && hits.length > 0 && (
          <CommandGroup heading="Tasks">
            {hits.map((t) => (
              <CommandItem key={`start-${t.id}`} value={`start ${t.title} ${t.id}`} keywords={[query]} onSelect={() => go(`/focus?task=${t.id}`)}>
                Start: {t.firstAction || t.title}<CommandShortcut>{t.status}</CommandShortcut>
              </CommandItem>
            ))}
            {hits.filter((t) => t.status !== 'today' && t.status !== 'evening').slice(0, 3).map((t) => (
              <CommandItem key={`today-${t.id}`} value={`today ${t.title} ${t.id}`} keywords={[query]} onSelect={() => toToday(t)}>
                Move to Today: {t.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Do">
          <CommandItem onSelect={() => run(onCapture)}>Capture a task<CommandShortcut>Q</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go('/plan')}>Plan my day</CommandItem>
          <CommandItem onSelect={() => go('/focus?run=1')}>Run my Today list</CommandItem>
          <CommandItem onSelect={() => go('/goals/new')}>New goal</CommandItem>
          <CommandItem onSelect={() => go('/speak/drill?type=impromptu')}>Quick speaking drill</CommandItem>
          <CommandItem onSelect={() => go('/focus')}>Start focus</CommandItem>
          <CommandItem onSelect={() => go('/inbox?process=1')}>Process inbox</CommandItem>
          <CommandItem onSelect={() => go('/calendar?reflow=1')}>Re-flow the rest of today</CommandItem>
          <CommandItem onSelect={() => go('/shutdown')}>Close the day</CommandItem>
          <CommandItem onSelect={() => go('/review')}>Weekly review<CommandShortcut>G R</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go('/aging')}>Decide on old tasks</CommandItem>
          <CommandItem onSelect={() => run(onWhatsLeft)}>What’s left<CommandShortcut>W</CommandShortcut></CommandItem>
        </CommandGroup>
        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => go('/')}>Home<CommandShortcut>G H</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go('/inbox')}>Inbox<CommandShortcut>G I</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go('/calendar')}>Calendar<CommandShortcut>G C</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go('/goals')}>Goals<CommandShortcut>G O</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go('/speak')}>Speak<CommandShortcut>G V</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go('/commitments')}>Promise vs reality</CommandItem>
          <CommandItem onSelect={() => go('/projects')}>Projects<CommandShortcut>G P</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go('/skills')}>Skills<CommandShortcut>G S</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go('/habits')}>Habits<CommandShortcut>G B</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => go('/aging?tab=killed')}>Kill list</CommandItem>
          <CommandItem onSelect={() => go('/someday')}>Later (backlog & someday)</CommandItem>
          <CommandItem onSelect={() => go('/settings')}>Settings</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Account">
          <CommandItem onSelect={() => run(() => void clearDevice().then(() => logout()))}>Log out</CommandItem>
        </CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
  )
}
