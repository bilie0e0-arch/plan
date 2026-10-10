/** Next-Best-Action engine (DESIGN §10.4) with scaffold-and-fade (§10.13). Deterministic rules, no AI. */
import { say, type Tone } from './copy'
import type { GuideLevel } from '../skills/skills'
import type { TimerMode } from '../focus/session'

export interface NowTask {
  id: string
  title: string
  mode: TimerMode
  plannedMinutes: number | null
  why: string | null
}

export interface NowContext {
  tone: Tone
  level: GuideLevel
  openSession: { taskTitle: string } | null
  dayPlanned: boolean
  dayClosed: boolean
  todayTasks: NowTask[]
  sessionsSinceBreak: number
  inboxCount: number
  hoursUntilDayEnd: number
  /** Calendar (M2) — optional so earlier callers keep working. */
  activeBlock?: { id: string; title: string; type: string } | null
  soonBlock?: { id: string; title: string; inMinutes: number } | null
  gapMinutes?: number | null
}

export type NowKind =
  | 'resume' | 'closed' | 'plan_day' | 'break' | 'shutdown'
  | 'start_task' | 'pick_task' | 'process_inbox' | 'empty' | 'block' | 'heads_up' | 'gap'

export interface NowCard {
  kind: NowKind
  message: string
  why: string | null
  href: string
  actionLabel: string
  task: NowTask | null
  /** Competent band: ask the user first; suggestion only on request. */
  askFirst: boolean
  alternatives: NowTask[]
}

const card = (c: Partial<NowCard> & Pick<NowCard, 'kind' | 'message' | 'href' | 'actionLabel'>): NowCard => ({
  why: null, task: null, askFirst: false, alternatives: [], ...c,
})

export function nowCard(c: NowContext): NowCard {
  if (c.openSession) {
    return card({ kind: 'resume', message: say(c.tone, 'resume', { title: c.openSession.taskTitle }), href: '/focus', actionLabel: 'Resume' })
  }
  if (c.activeBlock) {
    const href = c.activeBlock.type === 'speaking' ? `/speak/drill?block=${c.activeBlock.id}` : `/launch/${c.activeBlock.id}`
    return card({ kind: 'block', message: say(c.tone, 'block_ready', { title: c.activeBlock.title }), href, actionLabel: 'Sit down & start' })
  }
  if (c.soonBlock) {
    return card({
      kind: 'heads_up', message: say(c.tone, 'heads_up', { title: c.soonBlock.title, n: Math.max(1, c.soonBlock.inMinutes) }),
      href: `/launch/${c.soonBlock.id}`, actionLabel: 'Open launcher',
    })
  }
  if (c.dayClosed) return card({ kind: 'closed', message: say(c.tone, 'closed'), href: '/inbox', actionLabel: 'Open inbox' })
  if (!c.dayPlanned) {
    return card({ kind: 'plan_day', message: say(c.tone, 'plan_day'), href: '/plan', actionLabel: 'Plan my day', why: c.level === 'full' ? 'A planned day starts faster and ends calmer.' : null })
  }
  if (c.sessionsSinceBreak >= 3) {
    return card({ kind: 'break', message: say(c.tone, 'break', { n: c.sessionsSinceBreak }), href: '/focus/break', actionLabel: 'Take a break' })
  }
  if (c.hoursUntilDayEnd <= 1) {
    return card({ kind: 'shutdown', message: say(c.tone, 'shutdown'), href: '/shutdown', actionLabel: 'Close the day' })
  }
  const [first, ...rest] = c.todayTasks
  // Gap filler (§10.4 rule 8): a short gap before the next block gets something that fits.
  if (c.gapMinutes != null && c.gapMinutes >= 8 && c.gapMinutes < 30 && (!first || (first.plannedMinutes ?? 25) > c.gapMinutes)) {
    return card({
      kind: 'gap', message: say(c.tone, 'gap', { n: c.gapMinutes }), href: '/speak/drill?type=impromptu', actionLabel: 'Quick speaking drill',
      why: c.level === 'full' ? 'Small gaps turn into small wins instead of scrolling.' : null,
    })
  }
  if (first) {
    if (c.level === 'ask') {
      return card({
        kind: 'pick_task', message: say(c.tone, 'pick_task'), href: '/', actionLabel: 'Show suggestion',
        task: first, askFirst: true, why: first.why, alternatives: c.todayTasks,
      })
    }
    return card({
      kind: 'start_task',
      message: say(c.tone, 'start_task', { title: first.title }),
      href: `/focus?task=${first.id}`,
      actionLabel: first.plannedMinutes ? `Start · ${first.plannedMinutes}m` : 'Start',
      task: first,
      why: c.level === 'full' ? first.why : null,
      alternatives: c.level === 'full' ? rest.slice(0, 2) : [],
    })
  }
  if (c.inboxCount > 10) {
    return card({ kind: 'process_inbox', message: say(c.tone, 'process_inbox', { n: c.inboxCount }), href: '/inbox?process=1', actionLabel: 'Sort inbox' })
  }
  return card({ kind: 'empty', message: say(c.tone, 'empty'), href: '/plan', actionLabel: 'Add to today' })
}

// ───────────── Prompt budget (DESIGN §10.8) ─────────────

export interface PromptHistory { type: string; outcome: 'shown' | 'acted' | 'dismissed'; shownOn: string }

/**
 * Decide whether a prompt type may be shown today.
 * - Daily budget across types.
 * - A type ignored/dismissed 3 times in a row is throttled to every other day.
 */
export function mayShowPrompt(type: string, today: string, dayIndex: number, history: PromptHistory[], budget: number): boolean {
  const todays = history.filter((h) => h.shownOn === today)
  if (todays.some((h) => h.type === type)) return true // already shown today; keep it visible
  if (todays.length >= budget) return false
  const lastThree = history
    .filter((h) => h.type === type && h.shownOn !== today)
    .sort((a, b) => (a.shownOn < b.shownOn ? 1 : -1))
    .slice(0, 3)
  const ignored = lastThree.length === 3 && lastThree.every((h) => h.outcome !== 'acted')
  return ignored ? dayIndex % 2 === 0 : true
}
