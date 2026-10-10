'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Mic, Square, X } from 'lucide-react'
import { saveRecording } from '@/app/actions/speaking'
import { prosody } from '@/domain/speaking/prosody'
import { createClient } from '@/lib/supabase/client'
import { analyzeLoudness, DRILLS, FRAMEWORK_HINT, speechMetrics, tokenize, type DrillType } from '@/domain/speaking/metrics'
import { fmtClock } from '@/lib/format'
import { chime } from '@/lib/client/chime'

export interface ParentTake { id: string; targetSeconds: number; fillersPerMin: number | null; wpm: number | null; longPauses: number | null; oneFix: string | null }

type Phase = 'ready' | 'prep' | 'recording' | 'listen' | 'reveal' | 'saved'
const RUBRIC = [
  { key: 'clarity', label: 'Clarity', lo: 'Confusing', hi: 'Instantly clear' },
  { key: 'structure', label: 'Structure', lo: 'Wandering', hi: 'Clear start, point, end' },
  { key: 'confidence', label: 'Confidence', lo: 'Hesitant', hi: 'Steady' },
  { key: 'conciseness', label: 'Conciseness', lo: 'Padded', hi: 'Nothing to cut' },
  { key: 'engagement', label: 'Engagement', lo: 'Flat', hi: 'Holds attention' },
] as const
type RubricKey = (typeof RUBRIC)[number]['key']
const FRAME_MS = 100

type SR = { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null }

/**
 * Speaking Studio drill (DESIGN §7.2): pick → prep → record → listen back (required) →
 * self-rate + filler guess → reveal → one fix → save → retake.
 */
export function SpeakingDrill(props: {
  userId: string; drillType: DrillType; prompt: { id: string | null; text: string; framework: 'prep' | 'star' | null }
  targetSeconds: number; prepSeconds: number; fillers: string[]; takeNumber: number; parent: ParentTake | null
  blockId: string | null; sound: boolean
  keepAudio: boolean
}) {
  const router = useRouter()
  const drill = DRILLS[props.drillType]
  const [phase, setPhase] = useState<Phase>('ready')
  const [prepLeft, setPrepLeft] = useState(props.prepSeconds)
  const [elapsed, setElapsed] = useState(0)
  const [bars, setBars] = useState<number[]>([])
  const [blob, setBlob] = useState<Blob | null>(null)
  const [duration, setDuration] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [segments, setSegments] = useState<{ t: number; text: string }[]>([])
  const [srState, setSrState] = useState<'on' | 'unsupported' | 'failed'>('on')
  const [loud, setLoud] = useState<{ speakingSeconds: number; longPauses: number } | null>(null)
  const [voice, setVoice] = useState<{ pitchVar: number | null; volumeVar: number | null }>({ pitchVar: null, volumeVar: null })
  const [listened, setListened] = useState(false)
  const [rating, setRating] = useState<Partial<Record<RubricKey, number>>>({})
  const [guess, setGuess] = useState('')
  const [oneFix, setOneFix] = useState('')
  const [pending, start] = useTransition()
  const [savedId] = useState(() => crypto.randomUUID())
  // Optional live cue (Yoodli-style, rule-based): a soft tick when a filler word is heard.
  const [liveTick, setLiveTick] = useState(false)
  const liveTickRef = useRef(false)
  useEffect(() => {
    // Browser-only preference, read once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setLiveTick(localStorage.getItem('plan.speak.liveTick') === '1') } catch { /* storage unavailable */ }
  }, [])
  useEffect(() => { liveTickRef.current = liveTick }, [liveTick])

  const media = useRef<{ stream: MediaStream; rec: MediaRecorder; ctx: AudioContext; sr: SR | null; timer: ReturnType<typeof setInterval>; startedAt: number; rms: number[]; chunks: Blob[]; stopping: boolean } | null>(null)
  const showPrompt = !(props.drillType === 'impromptu' && phase === 'ready')

  // Prep countdown
  useEffect(() => {
    if (phase !== 'prep') return
    if (prepLeft <= 0) { void begin(); return }
    const t = setTimeout(() => setPrepLeft((p) => p - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, prepLeft])

  useEffect(() => () => cleanup(), [])

  function cleanup() {
    const m = media.current
    if (!m) return
    clearInterval(m.timer)
    m.sr?.abort()
    m.stream.getTracks().forEach((t) => t.stop())
    void m.ctx.close().catch(() => {})
  }

  async function begin() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m))
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32_000 } : undefined)
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      ctx.createMediaStreamSource(stream).connect(analyser)
      const buf = new Float32Array(analyser.fftSize)
      const state = { stream, rec, ctx, sr: null as SR | null, timer: 0 as unknown as ReturnType<typeof setInterval>, startedAt: Date.now(), rms: [] as number[], chunks: [] as Blob[], stopping: false }
      media.current = state
      rec.ondataavailable = (e) => e.data.size && state.chunks.push(e.data)
      rec.onstop = () => {
        const b = new Blob(state.chunks, { type: rec.mimeType || 'audio/webm' })
        setBlob(b)
        setDuration(Math.max(1, Math.round((Date.now() - state.startedAt) / 1000)))
        setLoud(analyzeLoudness(state.rms, FRAME_MS))
        void analyzeProsody(b).then(setVoice)
        cleanup()
        setPhase('listen')
      }
      rec.start(1000)

      // Free, on-device/browser speech recognition (Chrome/Edge). Drops "um/uh" — word fillers still count.
      const Ctor = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition
        ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition
      if (Ctor) {
        const sr = new Ctor()
        sr.continuous = true
        sr.interimResults = false
        sr.lang = navigator.language || 'en-US'
        sr.onresult = (e) => {
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i]!
            if (r.isFinal) {
              const text = r[0].transcript.trim()
              if (!text) continue
              setTranscript((t) => (t ? `${t} ${text}` : text))
              if (liveTickRef.current && hasFiller(text, props.fillers)) tick(state.ctx)
              setSegments((s) => [...s, { t: Math.round((Date.now() - state.startedAt) / 100) / 10, text }])
            }
          }
        }
        sr.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'aborted') setSrState('failed') }
        sr.onend = () => { if (!state.stopping && media.current === state) { try { sr.start() } catch { /* already started */ } } }
        try { sr.start(); state.sr = sr } catch { setSrState('failed') }
      } else setSrState('unsupported')

      let cued = false
      state.timer = setInterval(() => {
        analyser.getFloatTimeDomainData(buf)
        let sum = 0
        for (const x of buf) sum += x * x
        const rms = Math.sqrt(sum / buf.length)
        state.rms.push(rms)
        setBars((b) => [...b.slice(-59), rms])
        const secs = (Date.now() - state.startedAt) / 1000
        setElapsed(secs)
        if (!cued && secs >= props.targetSeconds) { cued = true; if (props.sound) chime() }
        if (secs >= props.targetSeconds * 2) stop()
      }, FRAME_MS)
      setPhase('recording')
    } catch {
      toast('Microphone unavailable. Allow mic access and try again.')
      setPhase('ready')
    }
  }

  function stop() {
    const m = media.current
    if (!m || m.stopping) return
    m.stopping = true
    clearInterval(m.timer)
    m.sr?.stop()
    // Give recognition a moment to deliver its final result.
    setTimeout(() => m.rec.state !== 'inactive' && m.rec.stop(), 600)
  }

  const audioUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])

  const metrics = useMemo(() => speechMetrics({
    transcript, durationSeconds: duration, speakingSeconds: loud?.speakingSeconds ?? null,
    longPauses: loud?.longPauses ?? 0, targetSeconds: props.targetSeconds, fillers: props.fillers,
  }), [transcript, duration, loud, props.targetSeconds, props.fillers])
  const rated = RUBRIC.every((r) => rating[r.key]) && guess !== ''
  const hasTranscript = transcript.trim().length > 0
  const topFiller = Object.entries(metrics.fillerBreakdown).sort((a, b) => b[1] - a[1])[0]

  function save() {
    start(async () => {
      let audioPath: string | null = null
      if (blob && props.keepAudio) {
        const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
        const path = `${props.userId}/${savedId}.${ext}`
        const { error } = await createClient().storage.from('recordings').upload(path, blob, { contentType: blob.type.split(';')[0] || 'audio/webm', upsert: false })
        if (!error) audioPath = path
        else toast('Audio upload failed — saving the metrics without audio.')
      }
      const r = await saveRecording({
        id: savedId, audioPath, promptId: props.prompt.id, promptText: props.prompt.text, drillType: props.drillType,
        framework: props.prompt.framework, parentId: props.parent?.id ?? null, takeNumber: props.takeNumber,
        targetSeconds: props.targetSeconds, durationSeconds: duration, speakingSeconds: loud?.speakingSeconds ?? null,
        longPauses: loud?.longPauses ?? 0, transcript, segments: segments.slice(0, 500), listened: true,
        rating: rating as Record<RubricKey, number>, guessedFillers: Number(guess) || 0, oneFix: oneFix || null, blockId: props.blockId,
        pitchVar: voice.pitchVar, volumeVar: voice.volumeVar,
      })
      if (!r.ok) return void toast(r.error)
      if (r.isBaseline) toast.success('Baseline saved — this is your “then”.')
      setPhase('saved')
      router.refresh()
    })
  }

  const highlighted = useMemo(() => {
    if (!hasTranscript) return null
    const fillers = new Set(props.fillers.filter((f) => !f.includes(' ')))
    return transcript.split(/(\s+)/).map((w, i) => {
      const t = tokenize(w)[0]
      return t && fillers.has(t) ? <mark key={i} className="rounded bg-amber-300/25 px-0.5 text-amber-100">{w}</mark> : <span key={i}>{w}</span>
    })
  }, [transcript, hasTranscript, props.fillers])

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-6 py-6">
      <div className="flex items-center justify-between text-sm text-white/50">
        <Link href="/speak" className="hover:text-white"><X className="inline size-4" /> Close</Link>
        <span>{drill.label} · take {props.takeNumber} · target {fmtClock(props.targetSeconds)}</span>
      </div>

      <div className="my-auto space-y-6 py-8">
        {showPrompt && (
          <div className="space-y-2 text-center">
            <p className="text-2xl font-extrabold leading-snug">{props.prompt.text}</p>
            {props.prompt.framework && <p className="text-sm text-teal-200/80">{FRAMEWORK_HINT[props.prompt.framework]}</p>}
            {props.parent?.oneFix && phase !== 'saved' && <p className="text-sm text-amber-200/90">Your fix for this take: {props.parent.oneFix}</p>}
          </div>
        )}

        {phase === 'ready' && (
          <div className="space-y-4 text-center">
            {props.drillType === 'impromptu' && <p className="text-white/70">The prompt appears when you press start. You get {props.prepSeconds} seconds to think.</p>}
            <p className="text-sm text-white/50">{drill.blurb}</p>
            <label className="flex items-center justify-center gap-2 text-sm text-white/60">
              <input type="checkbox" className="size-4 accent-teal-300" checked={liveTick}
                onChange={(e) => { setLiveTick(e.target.checked); try { localStorage.setItem('plan.speak.liveTick', e.target.checked ? '1' : '0') } catch { /* storage unavailable */ } }} />
              Soft tick when I use a filler word
            </label>
            <button onClick={() => (props.prepSeconds ? setPhase('prep') : void begin())}
              className="mx-auto flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-teal-300 font-medium text-[oklch(0.2_0.02_185)]">
              <Mic className="size-4" /> Start
            </button>
          </div>
        )}

        {phase === 'prep' && (
          <div className="space-y-3 text-center">
            <p className="text-sm uppercase tracking-wide text-white/40">Think</p>
            <p className="text-6xl font-light tabular">{prepLeft}</p>
            <button onClick={() => setPrepLeft(0)} className="text-sm text-white/50 hover:text-white">I’m ready — record now</button>
          </div>
        )}

        {phase === 'recording' && (
          <div className="space-y-6 text-center">
            <div className="flex h-20 items-center justify-center gap-[3px]" aria-hidden>
              {bars.map((b, i) => <span key={i} className="w-1 rounded-full bg-teal-300/80" style={{ height: `${Math.min(100, 6 + b * 600)}%` }} />)}
            </div>
            <p className={`text-5xl font-light tabular ${elapsed >= props.targetSeconds ? 'text-amber-200' : ''}`}>
              <span className="mr-2 inline-block size-3 animate-pulse rounded-full bg-rose-400 align-middle" />{fmtClock(elapsed)}
              <span className="text-xl text-white/40"> / {fmtClock(props.targetSeconds)}</span>
            </p>
            <button onClick={stop} className="mx-auto flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15">
              <Square className="size-4" /> Stop
            </button>
          </div>
        )}

        {phase === 'listen' && (
          <div className="space-y-6">
            <section className="space-y-2">
              <p className="text-sm text-white/60">1 · Listen back — rating unlocks after you’ve heard it</p>
              {audioUrl && (
                <audio data-testid="playback" controls src={audioUrl} className="w-full"
                  onTimeUpdate={(e) => { const a = e.currentTarget; if (a.duration && a.currentTime / a.duration >= 0.9) setListened(true) }}
                  onEnded={() => setListened(true)} />
              )}
              <div className="flex gap-2 text-xs">
                {[1, 1.25, 1.5].map((r) => (
                  <button key={r} className="rounded-md bg-white/5 px-2 py-1 hover:bg-white/10"
                    onClick={() => { const a = document.querySelector<HTMLAudioElement>('[data-testid="playback"]'); if (a) a.playbackRate = r }}>{r}×</button>
                ))}
              </div>
            </section>
            <fieldset disabled={!listened} className={`space-y-3 transition-opacity ${listened ? '' : 'opacity-40'}`}>
              <legend className="text-sm text-white/60">2 · Rate yourself (before seeing any numbers)</legend>
              {RUBRIC.map((r) => (
                <div key={r.key} className="flex items-center gap-3 text-sm">
                  <span className="w-28">{r.label}</span>
                  <div className="grid flex-1 grid-cols-5 gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} title={n === 1 ? r.lo : n === 5 ? r.hi : undefined} onClick={() => setRating((x) => ({ ...x, [r.key]: n }))}
                        className={`h-9 rounded-lg border ${rating[r.key] === n ? 'border-teal-300 bg-teal-300/15' : 'border-white/15 hover:bg-white/5'}`}>{n}</button>
                    ))}
                  </div>
                </div>
              ))}
              <label className="flex items-center gap-3 text-sm">
                <span className="w-28">Fillers you think you used</span>
                <input inputMode="numeric" value={guess} onChange={(e) => setGuess(e.target.value.replace(/\D/g, ''))}
                  className="h-9 w-20 rounded-lg border border-white/15 bg-white/5 px-2 outline-none" aria-label="Filler guess" />
              </label>
              <button disabled={!rated} onClick={() => setPhase('reveal')}
                className="h-12 w-full rounded-xl bg-teal-300 font-medium text-[oklch(0.2_0.02_185)] disabled:opacity-40">Reveal</button>
            </fieldset>
          </div>
        )}

        {phase === 'reveal' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 p-4">
              {hasTranscript ? (
                <p className="text-lg">
                  You guessed <b>{guess}</b>. There were <b>{metrics.fillerCount}</b>
                  {topFiller ? <> — mostly <i>“{topFiller[0]}”</i></> : null}.
                </p>
              ) : (
                <p className="text-sm text-white/70">
                  {srState === 'unsupported' ? 'This browser has no built-in speech recognition, so fillers and pace can’t be counted. Use Chrome or Edge for full metrics.'
                    : 'No transcript was captured this time (speech recognition was unavailable). Timing and pauses are still measured.'}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Stat label="Fillers / min" value={hasTranscript ? String(metrics.fillersPerMin) : '—'} prev={props.parent?.fillersPerMin} lowerBetter />
              <Stat label="Pace (wpm)" value={metrics.wpm ? String(metrics.wpm) : '—'} prev={props.parent?.wpm} />
              <Stat label="Long pauses" value={String(metrics.longPauses)} prev={props.parent?.longPauses} lowerBetter />
              <Stat label="Length" value={`${fmtClock(duration)} ${metrics.timeOnTarget ? '✓' : ''}`} />
            </div>
            {(voice.pitchVar !== null || voice.volumeVar !== null) && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Stat label="Pitch variety (semitones)" value={voice.pitchVar === null ? '—' : String(voice.pitchVar)} />
                <Stat label="Volume variety (dB)" value={voice.volumeVar === null ? '—' : String(voice.volumeVar)} />
                {voice.pitchVar !== null && voice.pitchVar < 2 && <p className="col-span-2 text-xs text-white/50">Pitch stayed quite flat — try lifting key words.</p>}
              </div>
            )}
            {hasTranscript && <p className="max-h-40 overflow-y-auto rounded-xl bg-white/5 p-3 text-sm leading-relaxed text-white/80">{highlighted}</p>}
            {hasTranscript && metrics.hedgesPerMin > 0 && <p className="text-xs text-white/50">Hedging (“I think”, “maybe”…): {metrics.hedgesPerMin}/min</p>}
            <label className="block space-y-1">
              <span className="text-sm text-white/60">One fix for your next take</span>
              <input value={oneFix} onChange={(e) => setOneFix(e.target.value)} maxLength={200}
                placeholder={topFiller ? `Drop “${topFiller[0]}” at the start of sentences` : 'State the main point in the first sentence'}
                className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 outline-none focus:border-teal-300/60" />
            </label>
            <button disabled={pending} onClick={save} className="h-12 w-full rounded-xl bg-teal-300 font-medium text-[oklch(0.2_0.02_185)] disabled:opacity-50">Save take</button>
          </div>
        )}

        {phase === 'saved' && (
          <div className="space-y-4 text-center">
            <p className="text-2xl font-extrabold">Take {props.takeNumber} saved.</p>
            {props.parent?.fillersPerMin != null && hasTranscript && (
              <p className="text-white/70">Fillers {props.parent.fillersPerMin} → {metrics.fillersPerMin}/min{metrics.wpm ? ` · pace ${metrics.wpm}` : ''}.</p>
            )}
            <div className="flex justify-center gap-2">
              {props.takeNumber < 5 && (
                <Link href={`/speak/drill?parent=${props.parent?.id ?? savedId}&take=${props.takeNumber + 1}`}
                  className="rounded-xl bg-teal-300 px-5 py-3 font-medium text-[oklch(0.2_0.02_185)]">Retake</Link>
              )}
              <Link href="/speak" className="rounded-xl bg-white/10 px-5 py-3">Done</Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function Stat({ label, value, prev, lowerBetter }: { label: string; value: string; prev?: number | null; lowerBetter?: boolean }) {
  const v = Number(value)
  const delta = prev != null && !Number.isNaN(v) ? v - prev : null
  const good = delta !== null && (lowerBetter ? delta < 0 : delta > 0)
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <p className="text-xs text-white/50">{label}</p>
      <p className="text-xl tabular">{value}</p>
      {delta !== null && delta !== 0 && <p className={`text-xs ${good ? 'text-teal-200' : 'text-white/50'}`}>{delta > 0 ? '+' : ''}{Math.round(delta * 10) / 10} vs last take</p>}
    </div>
  )
}

/** Decode the take at 16 kHz and measure pitch / volume variety (DESIGN §7.4). Runs after the take, off the hot path. */
async function analyzeProsody(b: Blob): Promise<{ pitchVar: number | null; volumeVar: number | null }> {
  try {
    await new Promise((r) => setTimeout(r, 50))
    const audio = await new OfflineAudioContext(1, 1, 16_000).decodeAudioData(await b.arrayBuffer())
    return prosody(audio.getChannelData(0), audio.sampleRate)
  } catch {
    return { pitchVar: null, volumeVar: null }
  }
}

/** A filler from the user's own list appears in a recognised phrase (single words by token, phrases by text). */
function hasFiller(text: string, fillers: string[]): boolean {
  const words = new Set(tokenize(text))
  const lower = ` ${tokenize(text).join(' ')} `
  return fillers.some((f) => (f.includes(' ') ? lower.includes(` ${f} `) : words.has(f)))
}

/** 40 ms, very quiet — noticeable to you, too soft to spoil the take. */
function tick(ctx: AudioContext) {
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 1400
    gain.gain.value = 0.04
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.04)
  } catch { /* audio context closed */ }
}
