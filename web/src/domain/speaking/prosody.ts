/**
 * Prosody metrics (DESIGN §7.4): pitch and volume variety from raw audio, computed in the browser.
 * Pitch variety = std-dev of voiced-frame pitch in semitones (monotone ≈ < 2).
 * Volume variety = std-dev of voiced-frame loudness in dB.
 */

const FRAME_SECONDS = 0.04
const MAX_PITCH_FRAMES = 800

function std(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
}

/** Fundamental frequency of one frame by normalised autocorrelation, or null if unvoiced. */
export function framePitch(frame: Float32Array, sampleRate: number, minHz = 70, maxHz = 400): number | null {
  const minLag = Math.floor(sampleRate / maxHz)
  const maxLag = Math.min(frame.length - 1, Math.ceil(sampleRate / minHz))
  let energy = 0
  for (const x of frame) energy += x * x
  if (energy <= 0) return null
  let bestLag = -1
  let best = 0
  const corr: number[] = []
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0, e1 = 0, e2 = 0
    for (let i = 0; i + lag < frame.length; i++) {
      c += frame[i]! * frame[i + lag]!
      e1 += frame[i]! * frame[i]!
      e2 += frame[i + lag]! * frame[i + lag]!
    }
    const n = c / Math.sqrt(e1 * e2 || 1)
    corr.push(n)
    if (n > best) { best = n; bestLag = lag }
  }
  if (bestLag < 0 || best < 0.6) return null
  // Prefer the shortest lag whose correlation is close to the best (avoids octave errors).
  for (let i = 1; i < corr.length - 1; i++) {
    if (corr[i]! >= best * 0.9 && corr[i]! >= corr[i - 1]! && corr[i]! >= corr[i + 1]!) {
      bestLag = minLag + i
      break
    }
  }
  return sampleRate / bestLag
}

export function prosody(samples: Float32Array, sampleRate: number): { pitchVar: number | null; volumeVar: number | null } {
  const size = Math.round(sampleRate * FRAME_SECONDS)
  const frames: { start: number; rms: number }[] = []
  for (let s = 0; s + size <= samples.length; s += size) {
    let sum = 0
    for (let i = s; i < s + size; i++) sum += samples[i]! * samples[i]!
    frames.push({ start: s, rms: Math.sqrt(sum / size) })
  }
  if (frames.length < 10) return { pitchVar: null, volumeVar: null }
  const sorted = frames.map((f) => f.rms).sort((a, b) => a - b)
  const p90 = sorted[Math.floor(sorted.length * 0.9)]!
  const threshold = Math.max(0.005, p90 * 0.25)
  const voiced = frames.filter((f) => f.rms >= threshold)
  const volumeVar = voiced.length >= 10 ? Math.round(std(voiced.map((f) => 20 * Math.log10(f.rms))) * 100) / 100 : null

  const step = Math.max(1, Math.floor(voiced.length / MAX_PITCH_FRAMES))
  const pitches: number[] = []
  for (let i = 0; i < voiced.length; i += step) {
    const f = voiced[i]!
    const hz = framePitch(samples.subarray(f.start, f.start + size), sampleRate)
    if (hz) pitches.push(hz)
  }
  let pitchVar: number | null = null
  if (pitches.length >= 10) {
    const med = [...pitches].sort((a, b) => a - b)[Math.floor(pitches.length / 2)]!
    pitchVar = Math.round(std(pitches.map((p) => 12 * Math.log2(p / med))) * 100) / 100
  }
  return { pitchVar: pitchVar === null ? null : Math.min(99, pitchVar), volumeVar: volumeVar === null ? null : Math.min(99, volumeVar) }
}
