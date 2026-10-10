/** Optional background noise for focus (generated locally, free). Brown noise: soft, low, steady. */

let ctx: AudioContext | null = null
let src: AudioBufferSourceNode | null = null

export function startNoise(volume = 0.18): void {
  if (src) return
  ctx = ctx ?? new AudioContext()
  const seconds = 4
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }
  const gain = ctx.createGain()
  gain.gain.value = volume
  src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  src.connect(gain).connect(ctx.destination)
  void ctx.resume()
  src.start()
}

export function stopNoise(): void {
  try { src?.stop() } catch { /* already stopped */ }
  src = null
}

const KEY = 'plan.focus.noise'
export function noisePreferred(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}
export function setNoisePreferred(on: boolean): void {
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* storage unavailable */ }
}
