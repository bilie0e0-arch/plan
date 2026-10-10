import { dialAngle, dialArc } from './dial-geometry'

/**
 * Small speedometer: time spent against a target. Purple once it runs over; `tone="light"` draws it in
 * white for coloured backgrounds (the timer bar).
 */
export function MiniDial({ value, size = 48, text, tone = 'default', className = '' }: {
  value: number; size?: number; text?: string; tone?: 'default' | 'light'; className?: string
}) {
  const f = Math.max(0, value)
  const over = f > 1
  const shown = Math.min(1, f)
  const light = tone === 'light'
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`flex-none ${className}`} aria-hidden>
      <path d={dialArc(50, 52, 38, 0, 1)} className={light ? 'stroke-white/30' : 'stroke-border'} strokeWidth="10" fill="none" strokeLinecap="round" />
      {shown > 0 && (
        <path d={dialArc(50, 52, 38, 0, shown)} className={light ? 'stroke-white' : over ? 'stroke-[#8C74D9]' : 'stroke-primary'}
          strokeWidth="10" fill="none" strokeLinecap="round" />
      )}
      <g style={{ transform: `rotate(${dialAngle(shown)}deg)`, transformOrigin: '50px 52px', transition: 'transform 1s linear' }}>
        <line x1="50" y1="52" x2="80" y2="52" className={light ? 'stroke-white' : 'stroke-foreground'} strokeWidth="5" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="52" r="7" className={light ? 'fill-white' : 'fill-foreground'} />
      {text && <text x="50" y="95" textAnchor="middle" className={`${light ? 'fill-white' : 'fill-foreground'} text-[17px] font-black`}>{text}</text>}
    </svg>
  )
}
