import { BreakScreen } from '@/components/focus/break-screen'

export default async function BreakPage({ searchParams }: { searchParams: Promise<{ m?: string; s?: string }> }) {
  const { m, s } = await searchParams
  const minutes = Math.min(30, Math.max(1, Number(m) || 5))
  return <BreakScreen minutes={minutes} sessionId={s ?? null} />
}
