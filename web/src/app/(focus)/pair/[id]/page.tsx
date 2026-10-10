import { notFound } from 'next/navigation'
import { getViewer } from '@/lib/data/viewer'
import { loadToday } from '@/lib/data/today'
import { PairRoom, type RoomList, type RoomTask } from '@/components/partner/pair-room'

export default async function PairPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const v = await getViewer()
  const [{ data: cs }, t, peopleRes, friendsRes, listsRes] = await Promise.all([
    v.supabase.from('co_sessions').select('id, minutes, status').eq('id', id).maybeSingle(),
    loadToday(),
    v.supabase.rpc('session_people', { p_cs: id }),
    v.supabase.rpc('friends_snapshot'),
    v.supabase.from('shared_lists').select('id, group_id, title, shared_list_items(id, title, done_at, created_at)').not('accepted_at', 'is', null).order('created_at'),
  ])
  if (!cs) notFound()
  const people = (peopleRes.data ?? []).filter((p) => p.user_id !== v.userId).map((p) => ({ id: p.user_id, name: p.display_name || `@${p.username}` }))
  const friends = (friendsRes.data ?? []) as unknown as { user_id: string; group_id: string; call_link: string | null }[]
  // Backup call link: a friend's in a one-to-one room, otherwise your own.
  const friendLink = people.length === 1 ? friends.find((f) => f.user_id === people[0]!.id)?.call_link : null

  // Shared lists you have with anyone in this room (each list belongs to one friendship).
  const groupWith = new Map(friends.filter((f) => people.some((p) => p.id === f.user_id)).map((f) => [f.group_id, people.find((p) => p.id === f.user_id)!.name]))
  const lists: RoomList[] = (listsRes.data ?? []).filter((l) => groupWith.has(l.group_id)).map((l) => ({
    id: l.id, title: l.title, withName: groupWith.get(l.group_id)!,
    items: (l.shared_list_items ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((i) => ({ id: i.id, title: i.title, done: !!i.done_at }))
      .sort((a, b) => Number(a.done) - Number(b.done)),
  }))
  const tasks: RoomTask[] = [...t.main, ...t.evening].filter((x) => !x.leftover).map((x) => ({ id: x.id, title: x.firstAction || x.title }))

  return (
    <PairRoom
      id={cs.id}
      userId={v.userId}
      people={people}
      callLink={friendLink || v.settings.call_link || null}
      tasks={tasks}
      lists={lists}
      sound={v.settings.sound_enabled}
    />
  )
}
