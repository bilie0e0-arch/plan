import { describe, expect, it } from 'vitest'
import { dialAngle, dialArc, dialPoint } from './dial-geometry'

describe('speedometer dial geometry', () => {
  it('sweeps 270° clockwise from bottom-left to bottom-right', () => {
    expect(dialAngle(0)).toBe(135)
    expect(dialAngle(0.5)).toBe(270) // straight up
    expect(dialAngle(1)).toBe(405)
    const [x, y] = dialPoint(50, 50, 10, 0.5)
    expect([x, y]).toEqual([50, 40])
  })

  it('rounds points so server and browser render the same SVG', () => {
    const [x, y] = dialPoint(210, 200, 170, 1 / 3)
    for (const n of [x, y]) expect(String(n)).toMatch(/^\d+(\.\d{1,2})?$/)
  })

  it('uses the large-arc flag only past 180° and clamps to the scale', () => {
    expect(dialArc(50, 52, 38, 0, 0.5)).toMatch(/ 0 0 1 /)
    expect(dialArc(50, 52, 38, 0, 0.9)).toMatch(/ 0 1 1 /)
    expect(dialArc(50, 52, 38, 0, 2)).toBe(dialArc(50, 52, 38, 0, 1))
    expect(dialArc(50, 52, 38, 0, 0)).toMatch(/^M/)
  })
})
