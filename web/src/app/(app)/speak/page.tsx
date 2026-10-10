import Link from 'next/link'
import { Mic } from 'lucide-react'
import { getViewer } from '@/lib/data/viewer'
import { loadSkills } from '@/lib/data/skills'
import { loadProjectOptions } from '@/lib/data/lists'
import { DRILLS, type DrillType } from '@/domain/speaking/metrics'
import { AudioPlayer, AddPromptForm, RecordingActions } from '@/components/speaking/studio-parts'
import { Button } from '@/components/ui/button'

export default async function SpeakPage() {
  const v = await getViewer()
  const [{ data: recs }, skills, projects] = await Promise.all([
    v.supabase.from('recordings')
      .select('id, drill_type, prompt_text, take_number, duration_seconds, target_seconds, fillers_per_min, filler_breakdown, wpm, time_on_target, audio_path, audio_deleted_at, is_milestone, recorded_at, parent_recording_id')
      .order('recorded_at', { ascending: false }).limit(300),
    loadSkills(),
    loadProjectOptions(),
  ])
  const all = recs ?? []
  const s7 = skills.byId.S7

  // Signed URLs for the few recordings shown with players.
  const sign = async (path: string | null, deleted: string | null) => {
    if (!path || deleted) return null
    const { data } = await v.supabase.storage.from('recordings').createSignedUrl(path, 1800)
    return data?.signedUrl ?? null
  }
  const recent = all.slice(0, 8)
  const recentUrls = await Promise.all(recent.map((r) => sign(r.audio_path, r.audio_deleted_at)))

  // Then vs Now: first and latest recording per drill type
  const pairs = await Promise.all((Object.keys(DRILLS) as DrillType[]).map(async (d) => {
    const mine = all.filter((r) => r.drill_type === d)
    if (mine.length < 2) return null
    const first = mine[mine.length - 1]!
    const latest = mine[0]!
    return { d, first, latest, firstUrl: await sign(first.audio_path, first.audio_deleted_at), latestUrl: await sign(latest.audio_path, latest.audio_deleted_at) }
  }))

  // Personal filler profile (last 30 recordings)
  const totals = new Map<string, number>()
  for (const r of all.slice(0, 30)) for (const [k, n] of Object.entries((r.filler_breakdown ?? {}) as Record<string, number>)) totals.set(k, (totals.get(k) ?? 0) + n)
  const fillerTotal = [...totals.values()].reduce((a, b) => a + b, 0)
  const topFillers = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)

  // Suggest the drill type practised least recently
  const lastBy = new Map<string, string>()
  for (const r of all) if (!lastBy.has(r.drill_type)) lastBy.set(r.drill_type, r.recorded_at)
  const suggested = (['impromptu', 'explain', 'structured', 'summarize'] as DrillType[]).sort((a, b) => (lastBy.get(a) ?? '').localeCompare(lastBy.get(b) ?? ''))[0]!
  const baselineLeft = (['impromptu', 'explain', 'structured'] as DrillType[]).filter((d) => !all.some((r) => r.drill_type === d))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Speak 🎤</h1>
          <p className="text-sm text-muted-foreground">Talk for a minute, listen back, see your numbers, try again.</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold tabular">{s7.display}</p>
          <p className="text-xs text-muted-foreground">{s7.needs ?? s7.detail}</p>
        </div>
      </header>

      {baselineLeft.length > 0 && (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          Baseline: record one {baselineLeft.map((d) => DRILLS[d].label).join(', ')} so progress can be shown later.
        </p>
      )}

      <section className="rounded-2xl bg-card shadow-soft p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Suggested</p>
        <p className="mt-1 text-lg font-medium">{DRILLS[suggested].label} · {Math.round(DRILLS[suggested].target / 60 * 10) / 10} min</p>
        <p className="text-sm text-muted-foreground">{DRILLS[suggested].blurb}</p>
        <Link href={`/speak/drill?type=${suggested}`}><Button className="mt-4"><Mic className="size-4" /> Start drill</Button></Link>
      </section>

      <section className="grid gap-2 sm:grid-cols-5">
        {(Object.keys(DRILLS) as DrillType[]).map((d) => (
          <Link key={d} href={`/speak/drill?type=${d}`} className="rounded-2xl bg-card shadow-soft p-3 text-sm hover:border-primary/40">
            <p className="font-bold">{DRILLS[d].label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{DRILLS[d].blurb}</p>
          </Link>
        ))}
      </section>

      {topFillers.length > 0 && (
        <section className="rounded-2xl bg-card shadow-soft p-5">
          <h2 className="text-sm font-medium">Your filler profile</h2>
          <div className="mt-3 space-y-2">
            {topFillers.map(([w, n]) => (
              <div key={w} className="flex items-center gap-3 text-sm">
                <span className="w-24">“{w}”</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-warning" style={{ width: `${(n / fillerTotal) * 100}%` }} /></div>
                <span className="w-10 text-right text-xs tabular text-muted-foreground">{Math.round((n / fillerTotal) * 100)}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {pairs.some(Boolean) && (
        <section className="space-y-3">
          <h2 className="font-bold">Then vs now</h2>
          {pairs.filter(Boolean).map((p) => (
            <div key={p!.d} className="grid gap-3 rounded-2xl bg-card shadow-soft p-4 sm:grid-cols-2">
              {[['First', p!.first, p!.firstUrl], ['Latest', p!.latest, p!.latestUrl]].map(([label, r, url]) => {
                const rec = r as typeof all[number]
                return (
                  <div key={label as string} className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">{label as string} · {DRILLS[rec.drill_type as DrillType].label} · {rec.recorded_at.slice(0, 10)}</p>
                    <AudioPlayer url={url as string | null} />
                    <p className="text-xs tabular text-muted-foreground">
                      {rec.fillers_per_min ?? '—'} fillers/min · {rec.wpm ?? '—'} wpm · {rec.time_on_target ? 'on target' : 'off target'}
                    </p>
                  </div>
                )
              })}
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-bold">Recent takes</h2>
        {recent.length === 0 ? <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No recordings yet.</p> : (
          <ul className="divide-y rounded-2xl bg-card shadow-soft" data-testid="recordings">
            {recent.map((r, i) => (
              <li key={r.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold">{DRILLS[r.drill_type as DrillType].label}</span>
                  <span className="text-xs text-muted-foreground">take {r.take_number} · {r.recorded_at.slice(0, 10)}</span>
                  {r.is_milestone && <span className="rounded bg-accent px-1.5 text-[11px] text-accent-foreground">milestone</span>}
                  <span className="ml-auto text-xs tabular text-muted-foreground">{r.fillers_per_min ?? '—'} f/min · {r.wpm ?? '—'} wpm · {r.duration_seconds}s</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{r.prompt_text}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <AudioPlayer url={recentUrls[i] ?? null} />
                  <RecordingActions id={r.id} milestone={r.is_milestone} retakeHref={r.take_number < 5 ? `/speak/drill?parent=${r.parent_recording_id ?? r.id}&take=${r.take_number + 1}` : null} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddPromptForm projects={projects} />
    </div>
  )
}
