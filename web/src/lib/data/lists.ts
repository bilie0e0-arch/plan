import 'server-only'
import { getViewer } from './viewer'
import type { ListTask } from '@/components/tasks/list-row'

const SELECT = 'id, title, first_action, status, kind, estimate_minutes, energy, project_id, created_at, done_when, if_then_trigger, if_then_minute, hidden_until, share_override, projects(name, color)'

/** Tasks in a list. Tasks hidden until a later day stay out unless `hidden` is asked for. */
export async function loadList(status: 'inbox' | 'someday' | 'backlog', ascending = true, hidden = false): Promise<ListTask[]> {
  const { supabase, today } = await getViewer()
  const base = supabase.from('tasks').select(SELECT).eq('status', status)
  const { data } = await (hidden ? base.gt('hidden_until', today) : base.or(`hidden_until.is.null,hidden_until.lte.${today}`))
    .order('created_at', { ascending })
  return (data ?? []).map((t) => ({
    id: t.id, title: t.title, firstAction: t.first_action, status: t.status, kind: t.kind,
    estimate: t.estimate_minutes, energy: t.energy as ListTask['energy'], projectId: t.project_id,
    projectName: t.projects?.name ?? null, projectColor: t.projects?.color ?? null, createdAt: t.created_at,
    doneWhen: t.done_when, ifThenTrigger: t.if_then_trigger, ifThenMinute: t.if_then_minute, hiddenUntil: t.hidden_until, shareOverride: t.share_override,
  }))
}

export async function loadProjectOptions() {
  const { supabase } = await getViewer()
  const { data } = await supabase.from('projects').select('id, name, color').neq('status', 'done').order('created_at')
  return data ?? []
}
