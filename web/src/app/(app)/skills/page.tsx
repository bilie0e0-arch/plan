import Link from 'next/link'
import { getViewer } from '@/lib/data/viewer'
import { loadSkills } from '@/lib/data/skills'
import { loadInsights, loadMissions, loadRecords } from '@/lib/data/training'
import { RECORDS } from '@/domain/training/records'
import { weekStart } from '@/domain/time/day'
import type { Band, SkillResult } from '@/domain/skills/skills'

/** Plain names (UI v0.6): what each skill means in everyday words. */
const META: Record<SkillResult['id'], { name: string; emoji: string; tint: string; start: { label: string; href: string } }> = {
  S1: { name: 'Focus', emoji: '🧘', tint: 'bg-accent', start: { label: 'Start a focus session', href: '/' } },
  S2: { name: 'Staying on track', emoji: '🎯', tint: 'bg-sky-soft', start: { label: 'Focus a little', href: '/' } },
  S3: { name: 'Time guessing', emoji: '⏳', tint: 'bg-sun-soft', start: { label: 'Guess a task’s time', href: '/' } },
  S4: { name: 'Getting started', emoji: '🚀', tint: 'bg-lilac-soft', start: { label: 'Plan your day', href: '/plan' } },
  S5: { name: 'Realistic days', emoji: '🗺️', tint: 'bg-leaf-soft', start: { label: 'Close today', href: '/shutdown' } },
  S6: { name: 'Getting it done', emoji: '✅', tint: 'bg-accent', start: { label: 'Focus with a goal', href: '/' } },
  S7: { name: 'Speaking', emoji: '🎤', tint: 'bg-lilac-soft', start: { label: '1-minute drill', href: '/speak/drill?type=impromptu' } },
  S8: { name: 'Keeping promises', emoji: '🤞', tint: 'bg-sky-soft', start: { label: 'Promise a block', href: '/calendar' } },
}
const BAND: Record<Band, string> = { developing: 'Growing', competent: 'Steady', strong: 'Strong' }

export default async function ProgressPage() {
  const v = await getViewer()
  const [s, insights, records, missions] = await Promise.all([loadSkills(), loadInsights(), loadRecords(), loadMissions(weekStart(v.today))])
  const mission = missions.find((m) => m.kind === 'main')
  const best = records[0]
  const pattern = insights[0]

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Your progress 🌱</h1>
          <p className="text-sm text-muted-foreground">You against your past self — nobody else.</p>
        </div>
        {s.calibrating && <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">Getting to know you · {s.baselineDaysLeft} day{s.baselineDaysLeft === 1 ? '' : 's'} left</span>}
      </header>

      {mission ? (
        <Link href="/review" className="block rounded-2xl bg-gradient-to-br from-sun-soft to-card p-4 shadow-soft">
          <div className="flex items-center gap-3">
            <span className="text-3xl" aria-hidden>🎯</span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">This week’s mission: {mission.title}</p>
              <p className="text-sm text-muted-foreground">{mission.done ? 'Complete — lovely work ✓' : mission.trainer}</p>
            </div>
            <span className="text-sm font-extrabold tabular">{mission.progress}/{mission.target}</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-card"><div className="h-full rounded-full bg-sun transition-all" style={{ width: `${Math.min(100, (mission.progress / mission.target) * 100)}%` }} /></div>
        </Link>
      ) : (
        <Link href="/review" className="flex items-center gap-3 rounded-2xl bg-sun-soft p-4">
          <span className="text-3xl" aria-hidden>🎯</span>
          <span className="flex-1"><b>Pick a mission for this week</b><span className="block text-sm text-muted-foreground">One skill to practise — chosen in the weekly review.</span></span>
          <span className="rounded-xl bg-card px-3 py-1.5 text-sm font-bold shadow-soft">Choose</span>
        </Link>
      )}

      <section aria-label="Skills" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {s.skills.map((k) => {
          const m = META[k.id]
          const trend = k.trend === 'better' ? '↑' : k.trend === 'worse' ? '↓' : ''
          return (
            <div key={k.id} className={`flex min-h-28 flex-col rounded-2xl p-3.5 ${m.tint}`}>
              <div className="flex items-center justify-between">
                <span className="text-xl" aria-hidden>{m.emoji}</span>
                {k.band && <span className="rounded-full bg-card/80 px-2 py-0.5 text-[11px] font-bold">{BAND[k.band]}</span>}
              </div>
              <p className="mt-1 font-extrabold leading-tight">{m.name}</p>
              {k.value !== null ? (
                <p className="text-sm font-bold tabular">{k.display} {trend && <span className={k.trend === 'better' ? 'text-success' : 'text-muted-foreground'} title={k.trend === 'better' ? 'Getting better' : 'Worth watching'}>{trend}</span>}</p>
              ) : (
                <Link href={m.start.href} className="mt-auto text-xs font-bold text-primary hover:underline">{m.start.label} →</Link>
              )}
              {k.value !== null && <p className="line-clamp-1 text-xs text-muted-foreground">{k.detail}</p>}
            </div>
          )
        })}
      </section>

      <section className="grid gap-2.5 sm:grid-cols-3">
        <div className="rounded-2xl bg-card p-4 shadow-soft">
          <p className="text-xl" aria-hidden>🏆</p>
          <p className="font-extrabold">Personal best</p>
          <p className="text-sm text-muted-foreground">{best ? `${RECORDS[best.type].label}: ${RECORDS[best.type].fmt(best.value)}` : 'Your first records appear as you go.'}</p>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-soft sm:col-span-2">
          <p className="text-xl" aria-hidden>🔎</p>
          <p className="font-extrabold">A pattern in your data</p>
          <p className="line-clamp-2 text-sm text-muted-foreground">{pattern ? pattern.text : 'After a few days of focus and closed days, the app spots patterns for you — like your best hours.'}</p>
          {pattern?.action && <Link href={pattern.action.href} className="text-sm font-bold text-primary hover:underline">{pattern.action.label}</Link>}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        {s.selfDirection !== null && <>You make {s.selfDirection}% of your choices yourself — the goal is needing the app less. · </>}
        {s.anchored ? 'Levels compare you with your own first weeks. · ' : ''}
        <Link href="/settings#guide" className="font-bold text-primary hover:underline">How much the app helps</Link>
      </p>
    </div>
  )
}
