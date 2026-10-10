'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Chips, HourStepper } from '@/components/ui/choice'
import { updateCalendarSettings, updateSpeakingSettings } from '@/app/actions/settings'
import { disablePush, savePushSubscription } from '@/app/actions/push'
import { deleteAccount } from '@/app/actions/account'
import { useTaskMutation } from '@/components/tasks/task-actions'

function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}


export function MoreSettings(props: {
  username: string
  calendar: { dayStartHour: number; dayEndHour: number; quietStartHour: number; quietEndHour: number; icsUrl: string; checklist: string[] }
  pushEnabled: boolean
  speaking: { fillerWords: string[]; audioRetentionDays: number | null; keepAudio: boolean }
  /** Essentials show notifications up top; the rest lives under Advanced. */
  part?: 'notifications' | 'rest'
}) {
  const { pending, run } = useTaskMutation()
  const [c, setC] = useState(props.calendar)
  const [checklist, setChecklist] = useState(props.calendar.checklist.join('\n'))
  const [fillers, setFillers] = useState(props.speaking.fillerWords.join(', '))
  const [retention, setRetention] = useState<string>(props.speaking.audioRetentionDays ? String(props.speaking.audioRetentionDays) : '')
  const [keepAudio, setKeepAudio] = useState(props.speaking.keepAudio)
  const [confirm, setConfirm] = useState('')

  async function enablePush() {
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!key || !('serviceWorker' in navigator) || !('PushManager' in window)) return toast('Notifications aren’t supported in this browser.')
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return toast('Notifications were not allowed. You can change this in your browser settings.')
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })
      run(() => savePushSubscription(sub.toJSON()), 'Notifications on. You’ll get at most two per block.')
    } catch {
      toast('Could not enable notifications on this device.')
    }
  }

  return (
    <div className="space-y-6">
      {props.part !== 'notifications' && (
      <Card title="Calendar">
        <Row label="Your day runs from">
          <div className="flex items-center gap-1">
            <HourStepper label="Day starts" value={c.dayStartHour} min={0} max={Math.min(23, c.dayEndHour - 1)} onChange={(h) => setC({ ...c, dayStartHour: h })} />
            <span className="text-sm">to</span>
            <HourStepper label="Day ends" value={c.dayEndHour} min={c.dayStartHour + 1} max={24} onChange={(h) => setC({ ...c, dayEndHour: h })} />
          </div>
        </Row>
        <Row label="Quiet hours" hint="No notifications in this window.">
          <div className="flex items-center gap-1">
            <HourStepper label="Quiet from" value={c.quietStartHour} onChange={(h) => setC({ ...c, quietStartHour: h })} />
            <span className="text-sm">to</span>
            <HourStepper label="Quiet until" value={c.quietEndHour} onChange={(h) => setC({ ...c, quietEndHour: h })} />
          </div>
        </Row>
        <div className="space-y-1">
          <p className="text-sm">Google Calendar (read-only)</p>
          <p className="text-xs text-muted-foreground">Google Calendar → Settings → your calendar → “Secret address in iCal format”. Free; your events appear as busy blocks.</p>
          <Input value={c.icsUrl} onChange={(e) => setC({ ...c, icsUrl: e.target.value })} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" />
        </div>
        <div className="space-y-1">
          <p className="text-sm">Block launcher setup checklist</p>
          <Textarea rows={4} value={checklist} onChange={(e) => setChecklist(e.target.value)} />
          <p className="text-xs text-muted-foreground">One item per line (max 8).</p>
        </div>
        <div className="flex justify-end">
          <Button disabled={pending} onClick={() => run(() => updateCalendarSettings({
            ...c, checklist: checklist.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 8),
          }), 'Calendar settings saved.')}>Save</Button>
        </div>
      </Card>
      )}

      {props.part !== 'rest' && (
      <Card title="Notifications">
        <p className="text-sm text-muted-foreground">
          Only for blocks you scheduled: at start and 5 minutes later if you haven’t begun. Never during focus or quiet hours. No streak or “we miss you” messages.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} variant="outline" onClick={enablePush}>Turn on for this device</Button>
          {props.pushEnabled && <Button variant="outline" disabled={pending} onClick={() => run(() => disablePush(), 'Notifications off.')}>Turn off on all devices</Button>}
        </div>
      </Card>
      )}

      {props.part !== 'notifications' && (
      <Card title="Speaking">
        <div className="space-y-1">
          <p className="text-sm">Filler words to count</p>
          <Input value={fillers} onChange={(e) => setFillers(e.target.value)} />
          <p className="text-xs text-muted-foreground">Comma-separated. Transcription uses your browser (free); it usually drops “um/uh”, so word fillers are the reliable signal.</p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={keepAudio} onChange={(e) => setKeepAudio(e.target.checked)} />
          <span>Keep the audio of my takes<span className="block text-xs text-muted-foreground">Off by default to save storage. You still listen back during each drill, and fillers, pace, ratings and transcripts are always saved.</span></span>
        </label>
        {keepAudio && (
          <Row label="Delete old audio after">
            <Chips label="Delete old audio after" size="sm" value={retention} onChange={setRetention}
              options={[{ value: '', label: 'Never' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }, { value: '365', label: '1 year' }]} />
          </Row>
        )}
        <div className="flex justify-end">
          <Button disabled={pending} onClick={() => run(() => updateSpeakingSettings({
            fillerWords: fillers.split(',').map((x) => x.trim()).filter(Boolean), audioRetentionDays: retention ? Number(retention) : null, keepAudio,
          }), 'Speaking settings saved.')}>Save</Button>
        </div>
      </Card>
      )}

      {props.part !== 'notifications' && (
      <Card title="Your data">
        <a href="/api/export" className="inline-block"><Button variant="outline">Export everything (JSON)</Button></a>
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Delete account</p>
          <p className="text-xs text-muted-foreground">Permanently removes your account, all data and all audio. This can’t be undone. Type <b>{props.username}</b> to confirm.</p>
          <div className="flex gap-2">
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="max-w-56" />
            <Button variant="destructive" disabled={pending || confirm !== props.username} onClick={() => run(() => deleteAccount(confirm))}>Delete account</Button>
          </div>
        </div>
      </Card>
      )}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3 rounded-2xl bg-card shadow-soft p-5"><h2 className="font-bold">{title}</h2>{children}</section>
}
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-sm">{label}</p>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
      {children}
    </div>
  )
}
