/** Weekly drill framed as a Mission (DESIGN §5.3, §10.11). Progress is derived from the week's own data. */
import type { SkillId, SkillResult } from '@/domain/skills/skills'

export interface MissionDef { title: string; target: number; unit: string; trainer: string }

export const MISSIONS: Record<SkillId, MissionDef> = {
  S1: { title: 'Finish 5 calm “Grow my focus” sessions', target: 5, unit: 'calm sessions', trainer: 'Grow my focus on deep tasks' },
  S2: { title: 'Do 8 sessions with almost no distractions', target: 8, unit: 'calm sessions', trainer: 'Tap “Got distracted” every time' },
  S3: { title: 'Guess the time 10 times', target: 10, unit: 'guesses', trainer: 'Guess the time on tasks with an estimate' },
  S4: { title: 'Use “Just 5 minutes” on 5 put-off tasks', target: 5, unit: 'quick starts', trainer: 'Just 5 minutes on anything put off' },
  S5: { title: 'Plan and close 5 days', target: 5, unit: 'closed days', trainer: 'Plan each morning, close each evening' },
  S6: { title: 'Get what you aimed for 8 times', target: 8, unit: 'goals met', trainer: 'Say what you’ll finish before each session' },
  S7: { title: 'Do 5 speaking drills', target: 5, unit: 'drills', trainer: 'One 5-minute drill a day' },
  S8: { title: 'Keep 5 promised blocks', target: 5, unit: 'kept blocks', trainer: 'Start each block when it begins' },
}

export interface WeekActivity {
  sessions: { mode: string; outcome: string; isClean: boolean; distractions: number; activeMinutes: number; goalMet: string | null }[]
  closedDays: number
  recordings: number
  keptBlocks: number
}

export function missionProgress(skill: SkillId, w: WeekActivity): number {
  const done = w.sessions.filter((s) => s.outcome !== 'abandoned')
  switch (skill) {
    case 'S1': return done.filter((s) => s.mode === 'ladder' && s.isClean).length
    case 'S2': return done.filter((s) => s.outcome === 'completed' && s.distractions <= 1 && s.activeMinutes >= 10).length
    case 'S3': return done.filter((s) => s.mode === 'blind').length
    case 'S4': return done.filter((s) => s.mode === 'starter').length
    case 'S5': return w.closedDays
    case 'S6': return done.filter((s) => s.goalMet === 'yes').length
    case 'S7': return w.recordings
    case 'S8': return w.keptBlocks
  }
}

const BAND_RANK = { developing: 0, competent: 1, strong: 2 } as const

/** Suggested drill = weakest trend: worsening first, then lowest band; skills without data last. */
export function suggestMissionSkill(skills: Pick<SkillResult, 'id' | 'band' | 'trend' | 'value'>[]): SkillId {
  const withData = skills.filter((s) => s.value !== null)
  if (!withData.length) return 'S1'
  const score = (s: (typeof withData)[number]) =>
    (s.trend === 'worse' ? 0 : s.trend === 'flat' ? 10 : 20) + (s.band ? BAND_RANK[s.band] * 3 : 0)
  return [...withData].sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id))[0]!.id
}
