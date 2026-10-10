import 'server-only'
import { cache } from 'react'
import { getViewer } from './viewer'

export type ShareLevel = 'exact' | 'count' | 'private'

export interface PartnerSnapshot {
  user_id: string
  group_id: string
  username: string
  display_name: string | null
  share_level: ShareLevel
  invites_mode: 'allowed' | 'online_only' | 'off'
  call_link: string | null
  presence: { status: 'online' | 'focus' | 'break' | 'offline'; focus_until: string | null; updated_at: string } | null
  planned?: number
  done?: number
  focus_today?: number
  focus_week?: number
  focus_last_week?: number
  slipped_today?: number
  kept_week?: number
  outcomes_week?: number
  outcomes_met?: number
  tasks?: { title: string; done: boolean }[]
  outcomes?: { text: string; result: string | null }[]
}

export interface FriendSnapshot extends PartnerSnapshot {
  /** What I share with this friend. */
  my_share_level: ShareLevel
  /** This friendship's shared weekly goal. */
  quest: { minutes: number; target: number } | null
}

/** Friends (DESIGN §8.4): everything a friend sees comes through friends_snapshot(), at the level chosen per friend. */
export const loadFriends = cache(async () => {
  const v = await getViewer()
  const { supabase, userId } = v
  const [snapRes, reqRes, listsRes, mine] = await Promise.all([
    supabase.rpc('friends_snapshot'),
    supabase.rpc('pending_partner_requests'),
    supabase.from('shared_lists').select('id, group_id, title, created_by, accepted_at, shared_list_items(id, title, done_at, created_by)').order('created_at'),
    supabase.rpc('partner_week_self'),
  ])
  const raw = (snapRes.data ?? []) as unknown as PartnerSnapshot[]
  const quests = await Promise.all(raw.map((f) => supabase.rpc('pair_quest', { p_group: f.group_id })))
  const friends: FriendSnapshot[] = raw.map((f, i) => {
    const q = quests[i]?.data as { minutes: number; target: number } | null
    return { ...(f as FriendSnapshot), quest: q ? { minutes: q.minutes, target: q.target } : null }
  })
  const reqs = (reqRes.data ?? []).map((r) => ({ id: r.id, incoming: r.incoming, username: r.username, displayName: r.display_name }))
  return {
    code: v.profile.partner_code,
    me: {
      shareLevel: v.settings.share_level as ShareLevel,
      presenceVisible: v.settings.presence_visible,
      invitesMode: v.settings.invites_mode as 'allowed' | 'online_only' | 'off',
      callLink: v.settings.call_link,
      week: (mine.data ?? null) as { focus_week: number; focus_last_week: number; outcomes_week: number; outcomes_met: number } | null,
    },
    friends,
    incoming: reqs.filter((r) => r.incoming),
    outgoing: reqs.filter((r) => !r.incoming),
    lists: (listsRes.data ?? []).map((l) => ({
      id: l.id, groupId: l.group_id, title: l.title, mine: l.created_by === userId, accepted: !!l.accepted_at,
      items: (l.shared_list_items ?? []).map((i) => ({ id: i.id, title: i.title, done: !!i.done_at, mine: i.created_by === userId }))
        .sort((x, y) => Number(x.done) - Number(y.done)),
    })),
  }
})

export type FriendsState = Awaited<ReturnType<typeof loadFriends>>
export const friendName = (f: { display_name: string | null; username: string }) => f.display_name || `@${f.username}`
