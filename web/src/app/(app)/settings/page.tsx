import { getViewer } from '@/lib/data/viewer'
import { SettingsForm } from '@/components/settings/settings-form'
import { MoreSettings } from '@/components/settings/more-settings'
import { TrainingSettings } from '@/components/settings/training-settings'
import { EssentialsSettings } from '@/components/settings/essentials'
import { OpenOnHash } from '@/components/settings/open-on-hash'
import { logoutEverywhere } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'

export default async function SettingsPage() {
  const v = await getViewer()
  const calendar = {
    dayStartHour: v.settings.day_start_hour, dayEndHour: v.settings.day_end_hour,
    quietStartHour: v.settings.quiet_start_hour, quietEndHour: v.settings.quiet_end_hour,
    icsUrl: v.settings.ics_url ?? '', checklist: Array.isArray(v.settings.setup_checklist) ? (v.settings.setup_checklist as string[]) : [],
  }
  const speaking = { fillerWords: v.settings.filler_words, audioRetentionDays: v.settings.audio_retention_days, keepAudio: v.settings.keep_audio }
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">@{v.profile.username}</p>
      </header>
      <EssentialsSettings focusAreas={v.settings.focus_areas} coachTone={v.tone} theme={v.settings.theme as 'system' | 'light' | 'dark'} workKind={v.settings.work_kind} dailyMinutes={v.settings.daily_focus_minutes} />
      <MoreSettings part="notifications" username={v.profile.username} calendar={calendar} pushEnabled={v.settings.push_enabled} speaking={speaking} />

      <OpenOnHash detailsId="advanced" />
      <details id="advanced" className="group space-y-6">
        <summary className="cursor-pointer list-none rounded-xl border px-4 py-3 text-sm text-muted-foreground hover:bg-muted">
          Advanced settings <span className="text-xs">— day &amp; limits, guide, calendar, speaking, training, your data</span>
        </summary>
        <div className="space-y-6 pt-6">
          <SettingsForm
            profile={{ displayName: v.profile.display_name, timezone: v.profile.timezone, dayBoundaryHour: v.profile.day_boundary_hour }}
            settings={{
              wipCap: v.settings.wip_cap, activeProjectCap: v.settings.active_project_cap,
              availableHours: v.settings.default_available_minutes / 60, coachTone: v.tone,
              dailyPromptBudget: v.settings.daily_prompt_budget, soundEnabled: v.settings.sound_enabled,
              theme: v.settings.theme as 'system' | 'light' | 'dark', overrides: v.overrides,
            }}
          />
          <MoreSettings part="rest" username={v.profile.username} calendar={calendar} pushEnabled={v.settings.push_enabled} speaking={speaking} />
          <TrainingSettings agingDays={v.settings.aging_days} personalBands={v.settings.personal_bands} anchoredAt={v.settings.anchored_at} />
          <section className="space-y-3 rounded-2xl bg-card shadow-soft p-5">
            <h2 className="font-bold">Security</h2>
            <p className="text-sm text-muted-foreground">To change your password, log out and use “Forgot password”, or log out of every device below.</p>
            <form action={logoutEverywhere}><Button variant="outline" type="submit">Log out of all devices</Button></form>
          </section>
        </div>
      </details>
    </div>
  )
}
