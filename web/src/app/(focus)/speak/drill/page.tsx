import { getViewer } from '@/lib/data/viewer'
import { DRILLS, type DrillType } from '@/domain/speaking/metrics'
import { SpeakingDrill, type ParentTake } from '@/components/speaking/speaking-drill'

const TYPES = Object.keys(DRILLS) as DrillType[]

export default async function DrillPage({ searchParams }: {
  searchParams: Promise<{ type?: string; parent?: string; take?: string; block?: string }>
}) {
  const sp = await searchParams
  const v = await getViewer()

  let parent: ParentTake | null = null
  let type: DrillType = TYPES.includes(sp.type as DrillType) ? (sp.type as DrillType) : 'impromptu'
  let prompt: { id: string | null; text: string; framework: 'prep' | 'star' | null } | null = null

  if (sp.parent) {
    const { data: p } = await v.supabase.from('recordings')
      .select('id, drill_type, prompt_id, prompt_text, framework, target_seconds, fillers_per_min, wpm, long_pause_count, time_on_target, one_fix')
      .eq('id', sp.parent).maybeSingle()
    if (p) {
      type = p.drill_type as DrillType
      prompt = { id: p.prompt_id, text: p.prompt_text, framework: p.framework as 'prep' | 'star' | null }
      // Compare against the most recent take in this chain.
      const { data: last } = await v.supabase.from('recordings').select('fillers_per_min, wpm, long_pause_count, time_on_target, one_fix, take_number')
        .or(`id.eq.${p.id},parent_recording_id.eq.${p.id}`).order('take_number', { ascending: false }).limit(1).maybeSingle()
      parent = {
        id: p.id, targetSeconds: p.target_seconds,
        fillersPerMin: last?.fillers_per_min != null ? Number(last.fillers_per_min) : null,
        wpm: last?.wpm ?? null, longPauses: last?.long_pause_count ?? null, oneFix: last?.one_fix ?? null,
      }
    }
  }

  if (!prompt) {
    // Not repeated within 14 days unless retaken deliberately (DESIGN §7.3).
    const since = new Date(v.now.getTime() - 14 * 86_400_000).toISOString()
    const [{ data: prompts }, { data: used }] = await Promise.all([
      v.supabase.from('speaking_prompts').select('id, text, framework').eq('drill_type', type).eq('active', true),
      v.supabase.from('recordings').select('prompt_id').gte('recorded_at', since).not('prompt_id', 'is', null),
    ])
    const usedIds = new Set((used ?? []).map((u) => u.prompt_id))
    const fresh = (prompts ?? []).filter((p) => !usedIds.has(p.id))
    const pool = fresh.length ? fresh : prompts ?? []
    const pick = pool.length ? pool[Math.floor(v.now.getTime() / 1000) % pool.length] : undefined
    prompt = pick ? { id: pick.id, text: pick.text, framework: pick.framework as 'prep' | 'star' | null } : { id: null, text: 'Talk about anything on your mind for a minute.', framework: null }
  }

  return (
    <SpeakingDrill
      userId={v.userId}
      keepAudio={v.settings.keep_audio}
      drillType={type}
      prompt={prompt}
      targetSeconds={parent?.targetSeconds ?? DRILLS[type].target}
      prepSeconds={DRILLS[type].prep}
      fillers={v.settings.filler_words}
      takeNumber={Math.min(5, Math.max(1, Number(sp.take) || 1))}
      parent={parent}
      blockId={sp.block ?? null}
      sound={v.settings.sound_enabled}
    />
  )
}
