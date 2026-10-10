import { describe, expect, it } from 'vitest'
import { analyzeLoudness, speechMetrics } from './metrics'

describe('speech metrics', () => {
  it('counts single- and multi-word fillers without double counting', () => {
    const m = speechMetrics({
      transcript: 'So basically I think you know the plan is like basically sound, you know.',
      durationSeconds: 60, speakingSeconds: 60, longPauses: 0, targetSeconds: 60,
    })
    expect(m.fillerBreakdown).toMatchObject({ so: 1, basically: 2, 'you know': 2, like: 1 })
    expect(m.fillerCount).toBe(6)
    expect(m.fillersPerMin).toBe(6)
    expect(m.hedgesPerMin).toBe(1) // "i think"
  })
  it('computes pace from speaking time and checks time-on-target (±15%)', () => {
    const words = Array.from({ length: 150 }, (_, i) => `w${i}`).join(' ')
    const m = speechMetrics({ transcript: words, durationSeconds: 68, speakingSeconds: 60, longPauses: 1, targetSeconds: 60 })
    expect(m.wpm).toBe(150)
    expect(m.timeOnTarget).toBe(true)
    expect(speechMetrics({ transcript: words, durationSeconds: 90, speakingSeconds: 60, longPauses: 0, targetSeconds: 60 }).timeOnTarget).toBe(false)
  })
  it('detects long pauses only between speech', () => {
    const f = 100 // ms per frame
    const loud = (n: number) => Array(n).fill(0.1)
    const quiet = (n: number) => Array(n).fill(0)
    const r = analyzeLoudness([...quiet(20), ...loud(30), ...quiet(40), ...loud(30), ...quiet(5), ...loud(10), ...quiet(50)], f)
    expect(r.longPauses).toBe(1) // the 4 s gap; the 0.5 s gap is natural rhythm
    expect(r.speakingSeconds).toBe(8) // 30+30+5+10 frames = 7.5 s → 8
  })
})
