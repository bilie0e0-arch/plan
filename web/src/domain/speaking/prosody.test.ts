import { describe, expect, it } from 'vitest'
import { framePitch, prosody } from './prosody'

const SR = 16_000
function tone(hzAt: (t: number) => number, seconds: number, ampAt: (t: number) => number = () => 0.5): Float32Array {
  const out = new Float32Array(Math.round(SR * seconds))
  let phase = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    phase += (2 * Math.PI * hzAt(t)) / SR
    out[i] = ampAt(t) * Math.sin(phase)
  }
  return out
}

describe('prosody', () => {
  it('finds the pitch of a frame', () => {
    const f = tone(() => 150, 0.04)
    expect(framePitch(f, SR)).toBeGreaterThan(145)
    expect(framePitch(f, SR)).toBeLessThan(155)
  })
  it('a flat tone is monotone; a gliding tone has pitch variety', () => {
    const flat = prosody(tone(() => 140, 3), SR)
    expect(flat.pitchVar).not.toBeNull()
    expect(flat.pitchVar!).toBeLessThan(0.5)
    const glide = prosody(tone((t) => 110 + 50 * Math.sin(t * 2), 3), SR)
    expect(glide.pitchVar!).toBeGreaterThan(2)
  })
  it('volume variety follows loudness changes', () => {
    const steady = prosody(tone(() => 140, 3), SR)
    const varied = prosody(tone(() => 140, 3, (t) => (Math.floor(t * 2) % 2 ? 0.6 : 0.15)), SR)
    expect(steady.volumeVar!).toBeLessThan(0.5)
    expect(varied.volumeVar!).toBeGreaterThan(4)
  })
  it('silence yields nothing', () => {
    expect(prosody(new Float32Array(SR), SR)).toEqual({ pitchVar: null, volumeVar: null })
  })
})
