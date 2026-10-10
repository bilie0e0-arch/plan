'use client'

import Link from 'next/link'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { fmtMinutes } from '@/lib/format'
import type { WhatsLeftData } from '@/components/shell/types'

/** What's Left panel (DESIGN §10.9): where do I stand right now? Every row leads to an action. */
export function WhatsLeft({ open, onOpenChange, data }: { open: boolean; onOpenChange: (o: boolean) => void; data: WhatsLeftData }) {
  const close = () => onOpenChange(false)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>What’s left</SheetTitle>
          <SheetDescription>{fmtMinutes(Math.max(0, Math.round(data.hoursLeft * 60)))} until your day ends</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          <Section title="Today">
            {!data.dayPlanned && <Row href="/plan" onClick={close} label="Plan your day" hint="3 min" accent />}
            {data.remaining.length === 0 && data.dayPlanned && <p className="text-sm text-muted-foreground">Nothing left on Today.</p>}
            {data.remaining.map((t) => (
              <Row key={t.id} href={`/focus?task=${t.id}`} onClick={close} label={t.title}
                hint={`${t.evening ? 'evening · ' : ''}${t.plannedMinutes ? `${t.plannedMinutes}m` : 'start'}`} />
            ))}
            <p className="pt-1 text-xs text-muted-foreground tabular">
              {data.doneCount} done · {fmtMinutes(data.focusMinutes)} focused · plan {fmtMinutes(data.fit.adjustedMinutes)} of {fmtMinutes(data.fit.availableMinutes)}
            </p>
          </Section>
          {data.goals.length > 0 && (
            <Section title="Goals this week">
              {data.goals.map((g) => {
                const unscheduled = Math.max(0, g.weeklyMinutes - Math.max(g.plannedMinutes, g.spentMinutes))
                const pct = Math.min(100, Math.round((g.spentMinutes / g.weeklyMinutes) * 100))
                return (
                  <div key={g.id} className="rounded-lg px-2 py-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <Link href={`/goals/${g.id}`} onClick={close} className="flex-1 truncate hover:underline">{g.title}</Link>
                      <span className="tabular text-xs text-muted-foreground">{fmtMinutes(g.spentMinutes)} / {fmtMinutes(g.weeklyMinutes)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                    {unscheduled > 0 && (
                      <Link href="/calendar" onClick={close} className="mt-1 inline-block text-xs text-warning-foreground hover:underline">
                        {fmtMinutes(unscheduled)} not on the calendar — find time
                      </Link>
                    )}
                  </div>
                )
              })}
            </Section>
          )}
          {data.budgets.length > 0 && (
            <Section title="This week">
              {data.budgets.map((b) => {
                const pct = b.budgetMinutes ? Math.min(100, Math.round((b.actualMinutes / b.budgetMinutes) * 100)) : 0
                return (
                  <Link key={b.id} href="/projects" onClick={close} className="block rounded-lg px-2 py-1.5 hover:bg-muted">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="size-2 rounded-full" style={{ background: `var(--project-${b.color})` }} />
                      <span className="flex-1 truncate">{b.name}</span>
                      {b.underServed && <span className="text-xs text-warning-foreground">behind</span>}
                      <span className="tabular text-xs text-muted-foreground">{fmtMinutes(b.actualMinutes)} / {fmtMinutes(b.budgetMinutes)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full ${b.underServed ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                )
              })}
            </Section>
          )}
          <Section title="Rituals & inbox">
            {data.dayPlanned && !data.dayClosed && <Row href="/shutdown" onClick={close} label="Close the day" hint="2 min" />}
            {data.dayClosed && <p className="text-sm text-muted-foreground">Day closed.</p>}
            <Row href="/inbox?process=1" onClick={close} label={`Inbox · ${data.inboxCount} to sort`} hint={data.inboxCount ? 'sort' : 'clear'} />
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function Row({ href, label, hint, onClick, accent }: { href: string; label: string; hint?: string; onClick: () => void; accent?: boolean }) {
  return (
    <Link href={href} onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted ${accent ? 'bg-accent text-accent-foreground' : ''}`}>
      <span className="flex-1 truncate">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Link>
  )
}
