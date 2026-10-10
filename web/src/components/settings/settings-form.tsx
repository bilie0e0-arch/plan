'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Choice, Chips, HourStepper, NumberStepper, type ChoiceOption } from '@/components/ui/choice'
import { updateProfile, updateSettings } from '@/app/actions/settings'
import { useTaskMutation } from '@/components/tasks/task-actions'
import type { Tone } from '@/domain/guide/copy'
import type { GuideOverrides } from '@/lib/data/viewer'

/** Every IANA timezone the browser knows, searchable; the current one is always included. */
function timeZones(current: string): ChoiceOption<string>[] {
  const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  return [...new Set([current, ...all])].map((tz) => ({ value: tz, label: tz.replace(/_/g, ' ') }))
}

type Area = keyof GuideOverrides
const AREAS: { key: Area; label: string }[] = [
  { key: 'now_card', label: 'Now card' },
  { key: 'timer_mode', label: 'Timer mode suggestions' },
  { key: 'morning_ritual', label: 'Morning ritual' },
  { key: 'session_goal', label: 'Session goal prompts' },
]

export function SettingsForm({ profile, settings }: {
  profile: { displayName: string | null; timezone: string; dayBoundaryHour: number }
  settings: {
    wipCap: number; activeProjectCap: number; availableHours: number; coachTone: Tone
    dailyPromptBudget: number; soundEnabled: boolean; theme: 'system' | 'light' | 'dark'; overrides: GuideOverrides
  }
}) {
  const { pending, run } = useTaskMutation()
  const [p, setP] = useState(profile)
  const [s, setS] = useState(settings)

  return (
    <div className="space-y-6">
      <Card title="Profile & day">
        <Row label="Display name"><Input className="h-9 w-56" value={p.displayName ?? ''} onChange={(e) => setP({ ...p, displayName: e.target.value })} /></Row>
        <Row label="Timezone"><div className="w-56"><Choice label="Timezone" sheetTitle="Your timezone" value={p.timezone} onChange={(tz) => setP({ ...p, timezone: tz })} options={timeZones(p.timezone)} /></div></Row>
        <Row label="Day ends at" hint="Late nights count as the previous day until this hour.">
          <HourStepper label="Day ends at" value={p.dayBoundaryHour} onChange={(h) => setP({ ...p, dayBoundaryHour: h })} />
        </Row>
        <Save pending={pending} onClick={() => run(() => updateProfile(p), 'Profile saved.')} />
      </Card>

      <Card title="Planning">
        <Row label="Today limit" hint="Fewer tasks finish more often.">
          <NumberStepper label="tasks" value={s.wipCap} min={3} max={9} onChange={(n) => setS({ ...s, wipCap: n })} />
        </Row>
        <Row label="Active projects limit">
          <NumberStepper label="projects" value={s.activeProjectCap} min={3} max={7} onChange={(n) => setS({ ...s, activeProjectCap: n })} />
        </Row>
        <Row label="Usual focused hours per day">
          <Input className="h-9 w-20" inputMode="decimal" value={String(s.availableHours)}
            onChange={(e) => setS({ ...s, availableHours: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} />
        </Row>
      </Card>

      <Card title="Coach" id="guide">
        <Row label="Prompts per day" hint="Budget for proactive nudges. Your own scheduled items don’t count.">
          <NumberStepper label="prompts" value={s.dailyPromptBudget} min={0} max={10} onChange={(n) => setS({ ...s, dailyPromptBudget: n })} />
        </Row>
        <p className="pt-2 text-sm text-muted-foreground">Guidance fades automatically as your skills grow. Override per area:</p>
        {AREAS.map((a) => (
          <Row key={a.key} label={a.label}>
            <Chips label={a.label} size="sm" value={s.overrides[a.key] ?? 'auto'} onChange={(v) => setS({ ...s, overrides: { ...s.overrides, [a.key]: v } })}
              options={[{ value: 'more' as const, label: 'More help' }, { value: 'auto' as const, label: 'Automatic' }, { value: 'less' as const, label: 'Less help' }]} />
          </Row>
        ))}
      </Card>

      <Card title="Sound">
        <Row label="End-of-session tone">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={s.soundEnabled} onChange={(e) => setS({ ...s, soundEnabled: e.target.checked })} />
        </Row>
      </Card>
      <Save pending={pending} label="Save settings" onClick={() => run(() => updateSettings({
        ...s, coachTone: undefined, theme: undefined, overrides: Object.fromEntries(Object.entries(s.overrides).filter(([, val]) => val)) as Record<Area, 'more' | 'auto' | 'less'>,
      }), 'Settings saved.')} />
    </div>
  )
}

function Card({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return <section id={id} className="space-y-3 rounded-2xl bg-card shadow-soft p-5"><h2 className="font-bold">{title}</h2>{children}</section>
}
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-sm">{label}</p>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
      {children}
    </div>
  )
}
function Save({ pending, onClick, label = 'Save' }: { pending: boolean; onClick: () => void; label?: string }) {
  return <div className="flex justify-end"><Button disabled={pending} onClick={onClick}>{label}</Button></div>
}
