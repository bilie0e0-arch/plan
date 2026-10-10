'use client'

import { useId, useMemo, useSyncExternalStore } from 'react'
import { fmtClock } from '@/lib/format'
import { dialArc, dialPoint, dialAngle } from '@/components/ui/dial-geometry'

const noSubscribe = () => () => {}
const CX = 210
const CY = 200
const R = 170

/**
 * The focus clock: a 270° speedometer. The needle sweeps the minutes, an inner ring of 60 dots ticks every
 * second so the clock always looks alive, and the last 20% of the scale is marked as the final stretch.
 * Count-up sessions (no planned length) run in 60-minute laps; Blind mode hides the needle and numbers.
 */
export function FocusGauge({ elapsed, plannedSec, blind, paused, endsAt, label }: {
  elapsed: number; plannedSec: number | null; blind: boolean; paused: boolean; endsAt: Date | null; label?: string
}) {
  const id = useId().replace(/:/g, '')
  const countUp = plannedSec === null
  const total = plannedSec ?? 3600
  const minutes = Math.round(total / 60)
  const over = !countUp && elapsed > total
  const f = blind ? 0 : countUp ? (elapsed % total) / total : Math.min(1, elapsed / total)
  const remaining = total - elapsed
  const sec = elapsed % 60

  const ticks = useMemo(() => {
    const step = [1, 2, 5, 10, 15].find((s) => minutes / s <= 12) ?? 15
    const out: { x1: number; y1: number; x2: number; y2: number; major: boolean; label: { x: number; y: number; n: number } | null }[] = []
    for (let i = 0; i <= minutes; i++) {
      const t = i / minutes, major = i % step === 0
      const [x1, y1] = dialPoint(CX, CY, R - 20, t)
      const [x2, y2] = dialPoint(CX, CY, R - (major ? 36 : 28), t)
      const [lx, ly] = dialPoint(CX, CY, R - 54, t)
      out.push({ x1, y1, x2, y2, major, label: major ? { x: lx, y: ly + 5, n: i } : null })
    }
    return out
  }, [minutes])

  const dots = useMemo(() => Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * 2 * Math.PI - Math.PI / 2
    return { x: Math.round((CX + 92 * Math.cos(a)) * 100) / 100, y: Math.round((CY - 18 + 92 * Math.sin(a)) * 100) / 100, big: i % 5 === 0 }
  }), [])

  // The end time is shown in the browser's own clock format, so it is only rendered after hydration.
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false)
  const ends = endsAt && inBrowser ? endsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null
  const read = blind ? '? ? : ? ?' : countUp ? fmtClock(elapsed) : over ? `+${fmtClock(-remaining)}` : fmtClock(remaining)
  const sub = paused ? '⏸ Paused — Space to continue'
    : blind ? 'Clock hidden — Enter when you think it’s time'
      : countUp ? (elapsed >= total ? `lap ${Math.floor(elapsed / total) + 1} · counting up` : 'counting up · no limit')
        : over ? `extra time · ${minutes} min done 🎉`
          : `left of ${minutes} min${ends ? ` · ends ${ends}` : ''}`

  return (
    <svg viewBox="0 0 420 384" className="w-full max-w-[min(92vw,500px,calc((100dvh-330px)*1.13))]" role="img"
      aria-label={blind ? 'Focus clock, time hidden' : `${read} ${sub}`}>
      <defs>
        <linearGradient id={`pg${id}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#5eead4" /><stop offset="1" stopColor="#7aa7f5" />
        </linearGradient>
        <filter id={`gl${id}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <path d={dialArc(CX, CY, R, 0, 1)} stroke="rgba(255,255,255,.08)" strokeWidth="22" fill="none" strokeLinecap="round" />
      {!countUp && !blind && <path d={dialArc(CX, CY, R, 0.8, 1)} stroke="rgba(245,181,68,.22)" strokeWidth="22" fill="none" strokeLinecap="round" />}
      {!blind && f > 0 && (
        <>
          <path d={dialArc(CX, CY, R, 0, f)} stroke={over ? '#a78bfa' : `url(#pg${id})`} strokeWidth="22" fill="none" strokeLinecap="round" filter={`url(#gl${id})`} opacity={0.5} />
          <path d={dialArc(CX, CY, R, 0, f)} stroke={over ? '#a78bfa' : `url(#pg${id})`} strokeWidth="22" fill="none" strokeLinecap="round" />
        </>
      )}
      {!blind && ticks.map((t, i) => (
        <g key={i}>
          <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.major ? 'rgba(238,242,240,.75)' : 'rgba(238,242,240,.25)'} strokeWidth={t.major ? 3 : 1.5} strokeLinecap="round" />
          {t.label && <text x={t.label.x} y={t.label.y} textAnchor="middle" className="fill-white/55 text-[15px] font-extrabold">{t.label.n}</text>}
        </g>
      ))}
      {blind && <text x={CX} y={CY - 40} textAnchor="middle" className="fill-white/55 text-[17px] font-extrabold">Trust your sense of time</text>}
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.big ? 3 : 2}
          fill={paused ? 'rgba(238,242,240,.12)' : i === sec ? '#F5B544' : i < sec ? 'rgba(238,242,240,.38)' : 'rgba(238,242,240,.12)'} />
      ))}
      {!blind && (
        <g style={{ transform: `rotate(${dialAngle(f)}deg)`, transformOrigin: `${CX}px ${CY}px`, transition: paused ? 'none' : 'transform 1s linear' }}>
          <path d={`M${CX - 14} ${CY - 4} L${CX + R - 30} ${CY} L${CX - 14} ${CY + 4} Z`} fill="#F5B544" />
        </g>
      )}
      <circle cx={CX} cy={CY} r="15" fill="#2C3A45" stroke="#F5B544" strokeWidth="4" />
      {label && <text x={CX} y={CY + 66} textAnchor="middle" className="fill-amber-200 text-[15px] font-black">{label}</text>}
      {!label && !countUp && !blind && !over && f >= 0.8 && <text x={CX} y={CY + 66} textAnchor="middle" className="fill-amber-200 text-[15px] font-black">Final stretch</text>}
      <text x={CX} y={CY + 134} textAnchor="middle" className={`fill-white text-[54px] font-black tabular ${paused ? 'animate-pulse' : ''}`}>{read}</text>
      <text x={CX} y={CY + 166} textAnchor="middle" className="fill-white/55 text-[15px] font-bold">{sub}</text>
    </svg>
  )
}
