import { MODE_LABEL, type TimerMode } from '@/domain/focus/session'

export function ProjectDot({ color, name }: { color: string | null; name?: string | null }) {
  if (!color) return null
  return <span title={name ?? undefined} className="inline-block size-2 shrink-0 rounded-full" style={{ background: `var(--project-${color})` }} />
}

export function Chip({ children, tone = 'muted', title }: { children: React.ReactNode; tone?: 'muted' | 'accent' | 'warning'; title?: string }) {
  const cls = tone === 'accent' ? 'bg-accent text-accent-foreground' : tone === 'warning' ? 'bg-warning-muted text-warning-foreground' : 'bg-muted text-muted-foreground'
  return <span title={title} className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] leading-none ${cls}`}>{children}</span>
}

/** "30m → ~48m" when the personal multiplier is known (DESIGN F15). */
export function EstimateChip({ estimate, adjusted }: { estimate: number | null; adjusted: number | null }) {
  if (!estimate) return null
  if (!adjusted || adjusted === estimate) return <Chip>{estimate}m</Chip>
  return <Chip title="Adjusted by your personal multiplier">{estimate}m → ~{adjusted}m</Chip>
}

export function ModeChip({ mode, minutes }: { mode: TimerMode; minutes: number | null }) {
  const short: Record<TimerMode, string> = { ladder: '🌱 Grow', blind: '🔮 Guess', starter: '🚀 5 min', timebox: '⏱️ Set', free: '♾️ Open' }
  return <Chip tone="accent" title={MODE_LABEL[mode]}>{short[mode]}{minutes && mode !== 'starter' ? ` ${minutes}` : ''}</Chip>
}
