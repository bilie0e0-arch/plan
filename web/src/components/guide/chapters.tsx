'use client'

import { useEffect, useState } from 'react'

/** Milliseconds since the chapter opened, ticking ~10×/s (still when the user prefers reduced motion). */
export function useTicker(key: string) {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t0 = performance.now()
    const id = setInterval(() => setT(performance.now() - t0), 100)
    return () => { clearInterval(id); setT(0) }
  }, [key])
  return t
}

// ───────────── tiny speedometer dial (same shape as the focus clock) ─────────────
const ang = (f: number) => ((135 + 270 * f) * Math.PI) / 180
const pt = (cx: number, cy: number, r: number, f: number) => [cx + r * Math.cos(ang(f)), cy + r * Math.sin(ang(f))] as const
function arc(cx: number, cy: number, r: number, f0: number, f1: number) {
  f1 = Math.max(f0 + 0.0001, f1)
  const [a, b] = pt(cx, cy, r, f0)
  const [c, d] = pt(cx, cy, r, f1)
  return `M${a} ${b} A${r} ${r} 0 ${270 * (f1 - f0) > 180 ? 1 : 0} 1 ${c} ${d}`
}

export function Dial({ f, size = 52, color = 'var(--primary)', label }: { f: number; size?: number; color?: string; label?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0" aria-hidden>
      <path d={arc(50, 52, 38, 0, 1)} stroke="var(--border)" strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d={arc(50, 52, 38, 0, Math.min(1, f))} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round" />
      <g style={{ transformOrigin: '50px 52px', transform: `rotate(${135 + 270 * Math.min(1, f)}deg)` }}>
        <line x1="50" y1="52" x2="80" y2="52" stroke="var(--foreground)" strokeWidth="4" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="52" r="6" fill="var(--foreground)" />
      {label && <text x="50" y="92" textAnchor="middle" style={{ font: '900 14px var(--font-sans)', fill: 'var(--foreground)' }}>{label}</text>}
    </svg>
  )
}

const SUBJ = {
  Biology: ['var(--leaf)', 'var(--leaf-soft)'], Spanish: ['var(--sky)', 'var(--sky-soft)'],
  Maths: ['var(--sun)', 'var(--sun-soft)'], Guitar: ['var(--lilac)', 'var(--lilac-soft)'],
} as const
type Subject = keyof typeof SUBJ
const Tag = ({ s }: { s: Subject }) => <span className="rounded-full px-2 py-0.5 text-[11px] font-black" style={{ background: SUBJ[s][1], color: SUBJ[s][0] }}>{s}</span>
const Card = ({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) =>
  <div className={`flex items-center gap-3 rounded-2xl bg-background px-3.5 py-3 font-extrabold shadow-soft ${className}`} style={style}>{children}</div>
const Play = ({ children = '▶' }: { children?: React.ReactNode }) =>
  <span className="ml-auto grid size-9 shrink-0 place-items-center rounded-xl bg-accent font-black text-primary">{children}</span>
const Col = ({ children, className = '' }: { children: React.ReactNode; className?: string }) =>
  <div className={`flex w-full max-w-[420px] flex-col gap-2.5 ${className}`}>{children}</div>

// ───────────── visuals ─────────────
function LoopVis({ t }: { t: number }) {
  const nodes = [['➕', 'Add', 'var(--sun-soft)'], ['🗓️', 'Plan', 'var(--sky-soft)'], ['⏱', 'Focus', 'var(--accent)'], ['✅', 'Done', 'var(--leaf-soft)'], ['🔁', 'Review', 'var(--lilac-soft)']]
  const act = Math.floor(t / 1200) % 5
  return (
    <div className="relative size-[300px] sm:size-[340px]">
      {nodes.map(([e, l, c], i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
        return (
          <div key={l} className="absolute w-24 -translate-x-1/2 -translate-y-1/2 text-center text-sm font-black" style={{ left: `${50 + 37 * Math.cos(a)}%`, top: `${50 + 37 * Math.sin(a)}%` }}>
            <div className={`mx-auto mb-1.5 grid size-16 place-items-center rounded-[22px] text-3xl shadow-soft transition-transform duration-300 ${i === act ? 'scale-115 ring-4 ring-primary' : ''}`} style={{ background: c }}>{e}</div>
            {l}
          </div>
        )
      })}
      <div className="absolute inset-0 grid place-items-center text-center text-sm font-black text-muted-foreground">every day<br /><span className="text-2xl text-foreground">↻</span><br />gets a bit better</div>
    </div>
  )
}

function AddVis({ t }: { t: number }) {
  const full = 'Read chapter 5 ~30m tomorrow 9am #Biology'
  const n = Math.min(full.length, Math.floor((t % 6500) / 90))
  const want = n >= full.length ? 3 : n > 30 ? 2 : n > 16 ? 1 : 0
  const chips = [['⏱ 30 min', 'var(--accent)'], ['📅 Tomorrow 9:00', 'var(--sky-soft)'], ['● Biology', 'var(--leaf-soft)']].slice(0, want)
  return (
    <Col>
      <Card className="border-2 border-primary bg-card"><span className="font-bold">{full.slice(0, n)}<span className="animate-pulse text-primary">|</span></span></Card>
      <div className="flex min-h-8 flex-wrap gap-1.5">
        {chips.map(([l, c]) => <span key={l} className="animate-pop rounded-full px-2.5 py-1.5 text-[13px] font-black" style={{ background: c }}>{l}</span>)}
      </div>
      <Card className="opacity-85"><Dial f={0} size={40} /><div><div>Practise 20 Spanish verbs</div><Tag s="Spanish" /> <span className="text-xs text-muted-foreground">20 min</span></div><Play /></Card>
    </Col>
  )
}

function TodayVis({ t }: { t: number }) {
  const f = 0.4 + ((t / 1000) % 30) / 50
  return (
    <Col>
      <div className="mb-1 flex items-center gap-3"><Dial f={0.52} size={74} label="1.6h" /><div><div className="text-xl font-black">Good morning 👋</div><div className="text-xs text-muted-foreground">1h 36m of 3h · 1 of 4 done</div></div></div>
      <Card className="outline-2 outline-primary"><Dial f={f} size={44} /><div><div>Chapter 4 — Cell respiration</div><Tag s="Biology" /> <span className="text-xs tabular text-muted-foreground">{Math.round(f * 50)} of 50 min · ticking</span></div><Play>⏸</Play></Card>
      <Card><Dial f={0.8} size={44} /><div><div>Guitar — F chord</div><Tag s="Guitar" /> <span className="text-xs text-muted-foreground">12 of 15 min</span></div><Play /></Card>
      <Card><Dial f={1} size={44} color="var(--lilac)" /><div><div>Past paper Q1–Q5</div><Tag s="Maths" /> <span className="text-xs text-muted-foreground">58 of 45 min · ran over</span></div><Play /></Card>
    </Col>
  )
}

function ClockVis({ t }: { t: number }) {
  const f = ((t / 1000) % 25) / 25
  const s = Math.round((1 - f) * 1500)
  const ticks: React.ReactNode[] = []
  for (let i = 0; i <= 25; i++) {
    const maj = i % 5 === 0
    const [a, b] = pt(160, 150, 112, i / 25)
    const [c, d] = pt(160, 150, maj ? 92 : 100, i / 25)
    ticks.push(<line key={`l${i}`} x1={a} y1={b} x2={c} y2={d} stroke={`rgba(238,242,240,${maj ? 0.75 : 0.25})`} strokeWidth={maj ? 3 : 1.5} strokeLinecap="round" />)
    if (maj) { const [x, y] = pt(160, 150, 76, i / 25); ticks.push(<text key={`t${i}`} x={x} y={y + 5} textAnchor="middle" style={{ font: '800 13px var(--font-sans)', fill: 'rgba(238,242,240,.55)' }}>{i}</text>) }
  }
  return (
    <div className="focus-bg w-full max-w-[420px] rounded-[22px] px-4 pb-3 pt-3.5 text-center text-[#EEF2F0]">
      <div className="font-extrabold">Chapter 4 — Cell respiration</div>
      <svg viewBox="0 0 320 250" width="100%" aria-hidden>
        <path d={arc(160, 150, 128, 0, 1)} stroke="rgba(255,255,255,.08)" strokeWidth="16" fill="none" strokeLinecap="round" />
        <path d={arc(160, 150, 128, 0, f)} stroke={f > 0.8 ? 'var(--sun)' : 'var(--primary)'} strokeWidth="16" fill="none" strokeLinecap="round" />
        {ticks}
        <g style={{ transformOrigin: '160px 150px', transform: `rotate(${135 + 270 * f}deg)` }}><path d="M148 146 L262 150 L148 154 Z" fill="var(--sun)" /></g>
        <circle cx="160" cy="150" r="11" fill="#2C3A45" stroke="var(--sun)" strokeWidth="3" />
        <text x="160" y="232" textAnchor="middle" className="tabular" style={{ font: '900 40px var(--font-sans)', fill: '#EEF2F0' }}>{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</text>
      </svg>
      <div className="flex flex-wrap justify-center gap-1.5 text-xs font-extrabold">
        <span className="rounded-lg bg-white/10 px-2.5 py-1.5">⏸ Pause · Space</span>
        <span className="rounded-lg bg-white/10 px-2.5 py-1.5">😵 Distracted · D</span>
        <span className="rounded-lg bg-primary px-2.5 py-1.5">✓ Done · Enter</span>
      </div>
    </div>
  )
}

function DayVis({ t }: { t: number }) {
  const k = Math.floor(t / 900) % 5
  return (
    <Col className="gap-3.5">
      <div className="flex gap-1">{[1, 1, 0, 0].map((o, i) => <i key={i} className={`h-1.5 flex-1 rounded-full ${o ? 'bg-primary' : 'bg-border'}`} />)}</div>
      <div className="text-2xl font-black">How’s your energy today?</div>
      <div className="grid grid-cols-5 gap-2">
        {['😴', '🥱', '🙂', '😊', '⚡'].map((e, i) => (
          <Card key={e} className={`flex-col gap-0.5 border-2 px-1 py-2.5 ${i === k ? 'border-primary bg-accent' : 'border-transparent'}`}><b>{i + 1}</b>{e}</Card>
        ))}
      </div>
      <div className="flex justify-end"><span className="rounded-2xl bg-primary px-5 py-3 font-extrabold text-primary-foreground">Next · Enter ↵</span></div>
    </Col>
  )
}

function CalendarVis({ t }: { t: number }) {
  const cols = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const blocks: [number, number, number, Subject][] = [[0, 1, 2, 'Biology'], [1, 1, 1.5, 'Biology'], [2, 2, 1.5, 'Maths'], [3, 1, 2, 'Biology'], [4, 1, 2, 'Biology'], [0, 8, 0.7, 'Spanish'], [2, 8, 0.7, 'Spanish'], [3, 9, 0.7, 'Guitar'], [4, 5, 1, 'Maths']]
  const p = (t % 4000) / 4000
  const h = Math.min(1, p * 1.6) * 3
  const H = 22
  return (
    <div className="relative w-full max-w-[440px] rounded-2xl bg-background p-2.5">
      <div className="mb-1.5 grid grid-cols-5 gap-1 text-center text-xs font-extrabold text-muted-foreground">{cols.map((c) => <span key={c}>{c}</span>)}</div>
      <div className="relative grid h-[240px] grid-cols-5 gap-1">
        {cols.map((c) => <div key={c} className="rounded-lg bg-card" />)}
        {blocks.map(([d, s, l, k], i) => (
          <div key={i} className="absolute rounded-md px-1.5 py-0.5 text-[11px] font-extrabold" style={{ left: `calc(${d} * 20% + 3px)`, width: 'calc(20% - 7px)', top: s * H, height: l * H, background: SUBJ[k][1], borderLeft: `4px solid ${SUBJ[k][0]}` }}>{k}</div>
        ))}
        <div className="absolute rounded-md border-2 border-dashed border-primary bg-accent px-1.5 py-0.5 text-[11px] font-black text-primary" style={{ left: 'calc(20% + 3px)', width: 'calc(20% - 7px)', top: 4 * H, height: Math.max(12, h * H) }}>
          {p > 0.7 ? 'Essay plan ✓' : `11:00–${11 + Math.floor(h)}:${h % 1 >= 0.5 ? '30' : '00'}`}
        </div>
        <div className="absolute text-2xl" style={{ left: 'calc(20% + 40px)', top: 4 * H + Math.max(12, h * H) - 8 }}>👆</div>
      </div>
    </div>
  )
}

function GoalsVis() {
  const goals: [string, string, Subject, number, string][] = [
    ['Biology finals — 75%+', 'Result · by 15 Dec', 'Biology', 0.7, '5.5h of 8h this week'],
    ['Spanish — hold a 5-min chat', 'Learning', 'Spanish', 0.45, '1.5h of 3h this week'],
    ['Guitar 15 min a day', 'Habit', 'Guitar', 0.85, '6 of 7 days'],
  ]
  return (
    <Col>
      {goals.map(([n, k, s, f, l]) => (
        <Card key={n} className="flex-col items-stretch gap-1.5">
          <div className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: SUBJ[s][0] }} /><b>{n}</b><span className="ml-auto text-xs text-muted-foreground">{k}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-border"><i className="block h-full" style={{ width: `${f * 100}%`, background: SUBJ[s][0] }} /></div>
          <span className="text-xs text-muted-foreground">{l}</span>
        </Card>
      ))}
    </Col>
  )
}

function ProgressVis() {
  const skills = [['🚀', 'Starting', 'Strong', 0.82, 'var(--primary)'], ['🎯', 'Staying focused', 'Growing', 0.55, 'var(--sky)'], ['⏳', 'Guessing time', 'Learning', 0.35, 'var(--sun)'], ['🤝', 'Keeping plans', 'Strong', 0.78, 'var(--leaf)']] as const
  return (
    <div className="grid w-full max-w-[420px] grid-cols-2 gap-2.5">
      {skills.map(([e, n, l, f, c]) => (
        <Card key={n} className="flex-col items-start gap-1">
          <span className="text-2xl">{e}</span><b>{n}</b><span className="text-xs" style={{ color: c }}>{l}</span>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border"><i className="block h-full" style={{ width: `${f * 100}%`, background: c }} /></div>
        </Card>
      ))}
      <Card className="col-span-2 bg-sun-soft">🏆 New best: 3 focus sessions in a row with no distractions</Card>
    </div>
  )
}

function ReviewVis() {
  return (
    <div className="w-full max-w-[400px] rounded-[22px] bg-gradient-to-br from-primary to-sky p-5 text-white">
      <div className="font-extrabold opacity-85">Week Wrapped · 5–11 Oct</div>
      <div className="text-[44px] font-black leading-tight tabular">14h 20m</div>
      <div className="font-extrabold opacity-90">focused this week · +2h vs last</div>
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        {[['86%', 'blocks kept'], ['Thu', 'best day'], ['23', 'sessions'], ['🎯', 'mission done']].map(([a, b]) => (
          <div key={b} className="rounded-xl bg-white/20 px-2.5 py-2"><b className="text-xl">{a}</b><div className="text-xs">{b}</div></div>
        ))}
      </div>
    </div>
  )
}

function SpeakVis({ t }: { t: number }) {
  return (
    <Col className="items-center gap-4">
      <div className="grid size-24 place-items-center rounded-full bg-destructive text-4xl text-white">🎤</div>
      <div className="flex h-10 items-center gap-[3px]">
        {Array.from({ length: 28 }, (_, i) => <i key={i} className="w-[5px] rounded-full bg-primary" style={{ height: 8 + 30 * Math.abs(Math.sin(t / 300 + i * 0.7)) }} />)}
      </div>
      <div className="grid w-full grid-cols-3 gap-2">
        {[['142', 'words/min'], ['2.1', 'fillers/min'], ['A−', 'clarity']].map(([a, b]) => <Card key={b} className="flex-col gap-0"><b className="text-2xl">{a}</b><span className="text-xs text-muted-foreground">{b}</span></Card>)}
      </div>
    </Col>
  )
}

function FriendsVis({ t }: { t: number }) {
  const f = 0.25 + ((t / 1000) % 40) / 80
  const left = Math.round((1 - f) * 50)
  const people = [['🧑‍🎓', 'You', 'Biology', 'var(--accent)'], ['👩‍💻', 'Sam', 'Maths · 2 of 4 done', 'var(--sun-soft)'], ['🧑‍🎨', 'Meera', '3 planned', 'var(--lilac-soft)']]
  return (
    <Col className="items-center gap-4">
      <div className="flex items-center gap-2 rounded-full bg-background px-4 py-2 font-black shadow-soft"><Dial f={f} size={40} /><span className="tabular">{left} min left together</span></div>
      <div className="grid w-full grid-cols-3 gap-2.5">
        {people.map(([e, n, s, c]) => (
          <div key={n} className="flex flex-col items-center gap-1 text-center">
            <div className="grid size-16 place-items-center rounded-full text-3xl" style={{ background: c }}>{e}</div>
            <b>{n}</b><span className="text-xs text-muted-foreground">{s}</span>
          </div>
        ))}
      </div>
      <Card>🎉 Sam sent a 👏</Card>
    </Col>
  )
}

function KeysVis() {
  const keys = [['Enter', 'Next step / save / done'], ['Esc', 'Back / close'], ['Q', 'Add something'], ['Space', 'Pause the clock'], ['Ctrl K', 'Find & do anything'], ['G then H', 'Go to Today (G C = calendar…)'], ['?', 'Help for this screen']]
  return (
    <div className="grid w-full max-w-[420px] grid-cols-[auto_1fr] items-center gap-x-3.5 gap-y-2.5 text-[15px] font-bold">
      {keys.map(([k, d]) => (
        <span key={k} className="contents">
          <span className="inline-grid h-10 min-w-11 place-items-center rounded-xl bg-background px-2.5 font-black shadow-[0_3px_0_var(--border)]">{k}</span><span>{d}</span>
        </span>
      ))}
    </div>
  )
}

// ───────────── chapters ─────────────
export interface Chapter {
  id: string; group: string; icon: string; tint: string; name: string
  title: string; why: string; steps: React.ReactNode[]; tip: string; keys?: [string, string][]
  /** Where "Try it now" goes. */
  href?: string
  Visual: (p: { t: number }) => React.ReactNode
}

export const CHAPTERS: Chapter[] = [
  { id: 'start', group: 'Start here', icon: '👋', tint: 'bg-accent', name: 'How Plan works',
    title: 'One simple loop, every day', why: 'Plan helps you study and build skills by doing the next small thing — and getting better at it each week.',
    steps: [<><b>Add</b> what you want to do — a few words is enough.</>, <><b>Plan</b> it onto your day or week.</>, <><b>Focus</b> with the big clock, then mark it <b>done</b>.</>, <>Once a week, <b>review</b> — the app shows what worked.</>],
    tip: 'You never have to use everything. Today + the clock is a complete way to use Plan.', Visual: LoopVis },
  { id: 'add', group: 'Start here', icon: '➕', tint: 'bg-sun-soft', name: 'Add things fast', href: '/',
    title: 'Add in plain words', why: 'Type it like you’d say it. Plan picks out the time, length and project for you.',
    steps: [<>Type in the box on Today and press <b>Enter</b>.</>, <>Add <b>~30m</b> for length, <b>tomorrow 9am</b> for a time, <b>#Biology</b> for a project.</>, <><b>Shift+Enter</b> adds it and keeps the box open for the next one.</>, <>Or tap 🎤 and say it.</>],
    tip: 'Not sure when? Just add it — it waits in your list until you place it.',
    keys: [['Enter', 'add'], ['Shift+Enter', 'add & next'], ['Q', 'add from anywhere']], Visual: AddVis },
  { id: 'today', group: 'Every day', icon: '☀️', tint: 'bg-sun-soft', name: 'Your Today screen', href: '/',
    title: 'Today shows only what matters now', why: 'Your list for today, each with a little dial showing time spent against your estimate.',
    steps: [<>Press <b>▶</b> on a task — the clock starts at once.</>, <>The dial fills as you work. Purple means you ran over (that’s fine — it teaches your estimates).</>, <>Tap <b>✓</b> when it’s done. The big dial at the top is your whole day.</>],
    tip: 'The highlighted card at the top is the app’s one suggestion. Ignore it any time.', Visual: TodayVis },
  { id: 'clock', group: 'Every day', icon: '⏱', tint: 'bg-accent', name: 'The focus clock', href: '/',
    title: 'A big clock that keeps you going', why: 'The needle sweeps across the minutes and the inner dots tick every second, so you always see time moving.',
    steps: [<>Pick a timer: <b>Set time</b>, <b>Grow my focus</b> (gets longer as you improve), <b>Just 5 minutes</b>, <b>Open</b>, or <b>Guess the time</b>.</>, <>Phone pulled you away? Press <b>D</b>. A stray thought? <b>P</b> parks it for later.</>, <>Press <b>Enter</b> when done — rate how it went in one tap.</>],
    tip: 'The yellow end of the dial is your final stretch. Past the end it turns purple and counts extra time.',
    keys: [['Space', 'pause'], ['D', 'distracted'], ['P', 'park a thought'], ['Enter', 'done']], Visual: ClockVis },
  { id: 'day', group: 'Every day', icon: '🌙', tint: 'bg-lilac-soft', name: 'Start & close the day', href: '/plan',
    title: 'Two minutes morning and night', why: 'A quick check-in in the morning and a short wrap-up at night. Every step works with Enter.',
    steps: [<><b>Plan my day</b>: energy → pick today’s tasks → done. Press Enter on each step.</>, <><b>Close the day</b>: tick what’s finished, move the rest, one line on how it went.</>, <>Number keys pick an option; Esc goes back.</>],
    tip: 'Skipped a day? Nothing breaks. Just start again tomorrow.',
    keys: [['1–5', 'choose'], ['Enter', 'next'], ['Esc', 'back']], Visual: DayVis },
  { id: 'calendar', group: 'Plan ahead', icon: '🗓️', tint: 'bg-sky-soft', name: 'Calendar', href: '/calendar',
    title: 'Drag to block time', why: 'Give your study a time and it actually happens. Day, Week and Month views — colours show each project.',
    steps: [<><b>Drag down</b> on an empty time, type a name, press <b>Enter</b>. Or type “Biology 4–6pm tomorrow” in the quick-add box.</>, <>Tap a task or “hours left” chip on the left, then tap a time to place it.</>, <>Drag a block to move it; drag its bottom edge to make it longer.</>, <>Happy with the week? <b>Lock in my week</b> — later you’ll see plan vs. reality.</>],
    tip: 'Green stripes = hours when you usually keep your plans. Put hard things there.',
    keys: [['D / W / M', 'day · week · month'], ['T', 'today'], ['← →', 'move'], ['N', 'quick add']], Visual: CalendarVis },
  { id: 'goals', group: 'Plan ahead', icon: '🎯', tint: 'bg-leaf-soft', name: 'Goals', href: '/goals',
    title: 'Goals turn into weekly hours', why: 'Say what you’re aiming for, and how many hours a week it needs. Plan keeps count.',
    steps: [<>Pick a kind: <b>Result</b> (pass the exam), <b>Learning</b> (understand chapter 5), or <b>Habit</b> (practise 20 min a day).</>, <>Set hours per week — they show up as “hours left to place” in the calendar.</>, <>Each week you guess how likely you are to hit it. Over time your guesses get sharper.</>],
    tip: 'Up to 5 active goals. Fewer is usually better.', Visual: GoalsVis },
  { id: 'progress', group: 'Get better', icon: '🌱', tint: 'bg-leaf-soft', name: 'Progress & skills', href: '/skills',
    title: 'See yourself improve', why: 'Plan measures 8 everyday skills — like starting on time and guessing how long things take — from what you actually do.',
    steps: [<>Each skill shows a level and the <b>one action</b> that trains it.</>, <>Personal bests and patterns appear as you use the app (“mornings go best for you”).</>, <>As a skill grows, the app’s hints fade away — you’re doing it yourself.</>],
    tip: 'Needs about a week of use before the numbers mean much.', Visual: ProgressVis },
  { id: 'review', group: 'Get better', icon: '🔁', tint: 'bg-lilac-soft', name: 'Weekly review', href: '/review',
    title: '10 minutes at the weekend', why: 'Look back, learn one thing, plan next week. It walks you through step by step — Enter all the way.',
    steps: [<>See your <b>Week Wrapped</b>: hours, blocks kept, best day.</>, <>Check your goals and pick next week’s <b>mission</b> (one small challenge).</>, <>Place next week’s hours and lock it in.</>],
    tip: 'Fri–Sun reviews this week and plans next week.', Visual: ReviewVis },
  { id: 'speak', group: 'Extras', icon: '🎤', tint: 'bg-sky-soft', name: 'Speak', href: '/speak',
    title: 'Practise explaining out loud', why: 'Explaining something is one of the best ways to learn it. Record a short answer and see clear numbers.',
    steps: [<>Pick a prompt — or “explain what you studied today”.</>, <>Talk for 60 seconds. Listen back if you like.</>, <>See your pace, filler words (um, like…) and pauses. Try again to beat it.</>],
    tip: 'Audio stays on your device unless you turn on “Keep the audio of my takes” in Settings.', Visual: SpeakVis },
  { id: 'friends', group: 'Extras', icon: '👥', tint: 'bg-sun-soft', name: 'Study with friends', href: '/partner',
    title: 'Focus together, even apart', why: 'Add study friends. Start sessions at the same time, with an optional call — like sharing a library table.',
    steps: [<>Share your friend code or an invite link. Add as many friends as you like.</>, <>For <b>each</b> friend, choose what they see: <b>Exact</b>, <b>Count</b> only, or <b>Private</b>.</>, <>Tap <b>Focus together</b>, pick 1–4 friends, a length and one call type for everyone (Video / Audio / No call) — everyone gets the same 3-2-1 and the same big clock.</>, <>Working on the same course? Start a <b>shared list</b> — tick it off right inside the study room.</>],
    tip: 'Mics mute while you focus. Anyone can switch the call for everyone. Removing a friend stops all sharing instantly.', Visual: FriendsVis },
  { id: 'keys', group: 'Extras', icon: '⌨️', tint: 'bg-muted', name: 'Keys & help',
    title: 'Shortcuts — and help is always one tap away', why: 'Everything works by tapping. Keys are a bonus if you’re on a computer.',
    steps: [<>Press <b>?</b> on any screen (or the round <b>?</b> button) to open this guide right at that topic.</>, <><b>Ctrl+K</b> finds any task and acts on it.</>],
    tip: 'You can re-open this guide any time from the account menu → How Plan works.', Visual: KeysVis },
]

/** Which chapter the ? button opens on each screen. */
export function chapterFor(path: string): string {
  const map: [string, string][] = [
    ['/calendar', 'calendar'], ['/goals', 'goals'], ['/skills', 'progress'], ['/review', 'review'], ['/habits', 'progress'],
    ['/speak', 'speak'], ['/partner', 'friends'], ['/pair', 'friends'], ['/plan', 'day'], ['/shutdown', 'day'], ['/focus', 'clock'],
    ['/inbox', 'add'], ['/projects', 'add'], ['/someday', 'add'], ['/aging', 'add'], ['/commitments', 'calendar'], ['/settings', 'keys'],
  ]
  if (path === '/') return 'today'
  return map.find(([p]) => path.startsWith(p))?.[1] ?? 'start'
}
