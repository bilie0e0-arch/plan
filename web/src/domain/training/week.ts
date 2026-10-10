/** Weekly rhythm: which week a review plans, fresh-start moments, the daily reflection question. */
import { addDays, dayOfWeek, weekStart } from '@/domain/time/day'

/**
 * Fri–Sun: review the current week and plan the next one.
 * Mon–Thu: review last week and plan the current one (a late review still counts).
 */
export function reviewWeeks(today: string): { planWeek: string; reviewedWeek: string } {
  const ws = weekStart(today)
  const planWeek = dayOfWeek(today) >= 4 ? addDays(ws, 7) : ws
  return { planWeek, reviewedWeek: addDays(planWeek, -7) }
}

/** Fresh-start prompt (DESIGN F23): Monday, or the 1st of the month (month wins). */
export function freshStart(today: string): 'month' | 'week' | null {
  if (today.endsWith('-01')) return 'month'
  if (dayOfWeek(today) === 0) return 'week'
  return null
}

export const REFLECTION_QUESTIONS = [
  'What made today’s best session work?',
  'Where did your attention go when it wandered?',
  'What did you put off today, and what was the real reason?',
  'Which estimate surprised you most today?',
  'What is one thing you’d plan differently tomorrow?',
  'When did you feel most absorbed today?',
  'What did you finish that you’re glad about?',
  'What got in the way of starting, and how could you make it easier?',
  'Did you keep the promises you made to yourself today?',
  'What did you learn today that you want to keep?',
] as const

/** One question per day, rotating deterministically. */
export function reflectionQuestion(today: string): string {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number]
  const n = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
  return REFLECTION_QUESTIONS[n % REFLECTION_QUESTIONS.length]!
}
