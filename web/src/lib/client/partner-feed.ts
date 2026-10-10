'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Friends feed (polling, browser → Supabase directly; no server functions, so it stays free at small scale).
 * Realtime can replace the polling later without changing the UI.
 */
export interface IncomingInvite { id: string; from_user: string; party: number; minutes: number; call_mode: string; created_at: string; status: string; snooze_until: string | null }
export interface InviteReply { id: string; to_user: string; status: string; co_session_id: string | null }
export type Presence = { status: string; focus_until: string | null; updated_at: string }
export interface FeedState {
  invites: IncomingInvite[]
  replies: InviteReply[]
  requests: { id: string; username: string; displayName: string | null }[]
  reactions: { id: string; from_user: string; kind: string; created_at: string }[]
  listInvites: { id: string; title: string; created_by: string }[]
  /** Each friend's presence (only friends who show it). */
  presence: Record<string, Presence>
}

const EMPTY: FeedState = { invites: [], replies: [], requests: [], reactions: [], listInvites: [], presence: {} }
const POLL_MS = 12_000
const BEAT_MS = 30_000

export function presenceStatus(p: Presence | null | undefined, now: number): 'online' | 'focus' | 'break' | 'offline' | null {
  if (!p) return null
  if (now - new Date(p.updated_at).getTime() > 90_000) return 'offline'
  return p.status as 'online' | 'focus' | 'break'
}

export async function beat(status: 'online' | 'focus' | 'break', focusUntil: string | null = null) {
  try { await createClient().rpc('beat', { p_status: status, p_focus_until: focusUntil as string }) } catch { /* offline */ }
}

export function usePartnerFeed(opts: { userId: string; friendIds: string[]; heartbeat?: boolean }) {
  const [feed, setFeed] = useState<FeedState>(EMPTY)
  const busy = useRef(false)
  const friendKey = opts.friendIds.join(',')

  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const sb = createClient()
      const nowIso = new Date().toISOString()
      const [inv, rep, req, rea, lists, pres] = await Promise.all([
        sb.from('session_invites').select('id, from_user, party, minutes, call_mode, created_at, status, snooze_until').eq('to_user', opts.userId)
          .in('status', ['pending', 'snoozed', 'later']).gt('expires_at', nowIso).order('created_at', { ascending: false }),
        sb.from('session_invites').select('id, to_user, status, co_session_id').eq('from_user', opts.userId)
          .in('status', ['accepted', 'snoozed', 'later', 'declined']).is('seen_by_sender_at', null).gt('responded_at', new Date(Date.now() - 35 * 60_000).toISOString()),
        sb.rpc('pending_partner_requests'),
        sb.from('reactions').select('id, from_user, kind, created_at').eq('to_user', opts.userId).is('seen_at', null).order('created_at', { ascending: false }).limit(10),
        sb.from('shared_lists').select('id, title, created_by').is('accepted_at', null).neq('created_by', opts.userId),
        friendKey ? sb.from('presence').select('user_id, status, focus_until, updated_at').in('user_id', friendKey.split(',')) : Promise.resolve({ data: [] }),
      ])
      setFeed({
        invites: inv.data ?? [],
        replies: rep.data ?? [],
        requests: (req.data ?? []).filter((r) => r.incoming).map((r) => ({ id: r.id, username: r.username, displayName: r.display_name })),
        reactions: rea.data ?? [],
        listInvites: (lists.data ?? []).map((l) => ({ id: l.id, title: l.title, created_by: l.created_by })),
        presence: Object.fromEntries((pres.data ?? []).map((p) => [p.user_id, { status: p.status, focus_until: p.focus_until, updated_at: p.updated_at }])),
      })
    } catch {
      // offline or signed out: keep the last state
    } finally {
      busy.current = false
    }
  }, [opts.userId, friendKey])

  useEffect(() => {
    // Polling subscription: the first fetch runs on mount, then on an interval.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    const tick = () => { if (!document.hidden) void refresh() }
    const t = setInterval(tick, POLL_MS)
    const onVis = () => { if (!document.hidden) void refresh() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [refresh])

  useEffect(() => {
    if (!opts.heartbeat) return
    void beat('online')
    const t = setInterval(() => { if (!document.hidden) void beat('online') }, BEAT_MS)
    const onVis = () => { if (!document.hidden) void beat('online') }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [opts.heartbeat])

  return { feed, refresh }
}

export async function markRepliesSeen(ids: string[]) {
  if (!ids.length) return
  await createClient().from('session_invites').update({ seen_by_sender_at: new Date().toISOString() }).in('id', ids)
}

export async function markReactionsSeen(ids: string[]) {
  if (!ids.length) return
  await createClient().from('reactions').update({ seen_at: new Date().toISOString() }).in('id', ids)
}

const RESUME_KEY = 'plan.resume'
export function saveResume(r: { taskId: string; title: string; minutes: number } | undefined) {
  try { if (r) localStorage.setItem(RESUME_KEY, JSON.stringify(r)) } catch { /* storage unavailable */ }
}
export function takeResume(): { taskId: string; title: string; minutes: number } | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY)
    localStorage.removeItem(RESUME_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

/** A friend as the shell knows them (names only; everything else comes through the feed or friends_snapshot). */
export interface FriendLite { id: string; name: string }
export const nameOf = (friends: FriendLite[], id: string | null | undefined, fallback = 'A friend') =>
  friends.find((f) => f.id === id)?.name ?? fallback

const CALL_KEY = 'plan.call'
export const CALL_LABEL: Record<string, string> = { video: ' · 📹 video call', audio: ' · 🎧 audio call', none: '' }
export type CallChoice = 'video' | 'audio' | 'none'
/** The call type picked when inviting, offered first in the room. */
export function saveCallChoice(c: CallChoice) {
  try { localStorage.setItem(CALL_KEY, c) } catch { /* storage unavailable */ }
}
export function loadCallChoice(): CallChoice | null {
  try { const c = localStorage.getItem(CALL_KEY); return c === 'video' || c === 'audio' || c === 'none' ? c : null } catch { return null }
}
