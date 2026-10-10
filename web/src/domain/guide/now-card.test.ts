import { describe, expect, it } from 'vitest'
import { mayShowPrompt, nowCard, type NowContext } from './now-card'

const ctx: NowContext = {
  tone: 'calm', level: 'full', openSession: null, dayPlanned: true, dayClosed: false,
  todayTasks: [
    { id: 't1', title: 'Open RC set 4', mode: 'ladder', plannedMinutes: 25, why: 'Deep work fits your morning' },
    { id: 't2', title: 'Email Raj', mode: 'timebox', plannedMinutes: 10, why: null },
  ],
  sessionsSinceBreak: 0, inboxCount: 0, hoursUntilDayEnd: 8,
}

describe('now card', () => {
  it('follows rule order: resume > plan > break > shutdown > task', () => {
    expect(nowCard({ ...ctx, openSession: { taskTitle: 'X' } }).kind).toBe('resume')
    expect(nowCard({ ...ctx, dayPlanned: false }).kind).toBe('plan_day')
    expect(nowCard({ ...ctx, sessionsSinceBreak: 3 }).kind).toBe('break')
    expect(nowCard({ ...ctx, hoursUntilDayEnd: 0.5 }).kind).toBe('shutdown')
    expect(nowCard(ctx)).toMatchObject({ kind: 'start_task', href: '/focus?task=t1', why: 'Deep work fits your morning' })
  })
  it('blocks come first; heads-up before a block; gaps get a filler', () => {
    expect(nowCard({ ...ctx, activeBlock: { id: 'b1', title: 'GMAT RC', type: 'focus' } })).toMatchObject({ kind: 'block', href: '/launch/b1' })
    expect(nowCard({ ...ctx, soonBlock: { id: 'b2', title: 'Write', inMinutes: 4 } }).kind).toBe('heads_up')
    expect(nowCard({ ...ctx, gapMinutes: 18 }).kind).toBe('gap')
    expect(nowCard({ ...ctx, gapMinutes: 45 }).kind).toBe('start_task')
  })
  it('fades: competent asks first, strong hides the why', () => {
    expect(nowCard({ ...ctx, level: 'ask' })).toMatchObject({ kind: 'pick_task', askFirst: true })
    expect(nowCard({ ...ctx, level: 'quiet' })).toMatchObject({ kind: 'start_task', why: null, alternatives: [] })
  })
  it('throttles prompts that were ignored three times and respects the budget', () => {
    const ignored = ['2026-10-01', '2026-10-02', '2026-10-03'].map((d) => ({ type: 'inbox', outcome: 'dismissed' as const, shownOn: d }))
    expect(mayShowPrompt('inbox', '2026-10-08', 3, ignored, 6)).toBe(false)
    expect(mayShowPrompt('inbox', '2026-10-08', 4, ignored, 6)).toBe(true)
    const full = [{ type: 'a', outcome: 'shown' as const, shownOn: '2026-10-08' }]
    expect(mayShowPrompt('inbox', '2026-10-08', 0, full, 1)).toBe(false)
  })
})
