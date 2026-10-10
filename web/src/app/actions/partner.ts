'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getViewer } from '@/lib/data/viewer'
import { publicEnv } from '@/lib/env'
import { stopSession } from './focus'
import type { Result } from './tasks'

const uuid = z.string().uuid()
const ok = (): Result => {
  revalidatePath('/', 'layout')
  return { ok: true }
}
type Out<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const REQUEST_MSG: Record<string, string> = {
  sent: 'Request sent.',
  paired: 'You’re now study friends!',
  not_found: 'No one has that code. Check it and try again.',
  already_friends: 'You’re already friends.',
  too_many_friends: 'That’s the friend limit (30). Remove someone first.',
  limit: 'Too many requests for now. Try again later.',
}

/** Pair by partner code (like a game player tag). */
export async function requestPartner(code: string): Promise<Out<{ status: string; message: string }>> {
  const p = z.string().trim().min(5).max(12).safeParse(code)
  if (!p.success) return { ok: false, error: 'Enter a code like PLN-7K3Q9.' }
  const { supabase } = await getViewer()
  const normalized = p.data.toUpperCase().replace(/^#/, '').replace(/^PLN(?!-)/, 'PLN-')
  const { data, error } = await supabase.rpc('request_partner', { p_code: normalized })
  if (error) return { ok: false, error: 'Could not send the request.' }
  revalidatePath('/', 'layout')
  const status = String(data)
  if (status !== 'sent' && status !== 'paired') return { ok: false, error: REQUEST_MSG[status] ?? 'Could not send the request.' }
  return { ok: true, status, message: REQUEST_MSG[status]! }
}

export async function respondPartnerRequest(id: string, action: 'accept' | 'decline' | 'block'): Promise<Result> {
  const p = z.object({ id: uuid, action: z.enum(['accept', 'decline', 'block']) }).safeParse({ id, action })
  if (!p.success) return { ok: false, error: 'Invalid request.' }
  const { supabase } = await getViewer()
  const { data, error } = await supabase.rpc('respond_partner_request', { p_id: p.data.id, p_action: p.data.action })
  if (error?.message.includes('already_friends')) return { ok: false, error: 'You’re already friends.' }
  if (error?.message.includes('too_many_friends')) return { ok: false, error: 'One of you has reached the friend limit (30).' }
  if (error || data === 'gone') return { ok: false, error: 'This request is no longer open.' }
  return ok()
}

export async function cancelPartnerRequest(id: string): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Invalid request.' }
  const { supabase } = await getViewer()
  await supabase.rpc('cancel_partner_request', { p_id: id })
  return ok()
}

export async function createInviteLink(): Promise<Out<{ url: string }>> {
  const { supabase } = await getViewer()
  const { data, error } = await supabase.rpc('create_invite_link')
  if (error || !data) return { ok: false, error: 'Could not create a link.' }
  return { ok: true, url: `${publicEnv.NEXT_PUBLIC_SITE_URL}/join/${data}` }
}

export async function acceptInviteLink(token: string): Promise<Result> {
  const p = z.string().regex(/^[0-9a-f]{32}$/).safeParse(token)
  if (!p.success) return { ok: false, error: 'This invite link isn’t valid.' }
  const { supabase } = await getViewer()
  const { data, error } = await supabase.rpc('accept_invite_link', { p_token: p.data })
  if (error || data !== 'paired') return { ok: false, error: data === 'already_friends' ? 'You’re already friends.' : 'This invite link has expired or was already used.' }
  return ok()
}

export async function regeneratePartnerCode(): Promise<Result> {
  const { supabase } = await getViewer()
  const { error } = await supabase.rpc('regenerate_partner_code')
  return error ? { ok: false, error: 'Could not create a new code.' } : ok()
}

/** Remove one friend: all sharing with them stops at once. */
export async function removeFriend(userId: string): Promise<Result> {
  if (!uuid.safeParse(userId).success) return { ok: false, error: 'Invalid friend.' }
  const { supabase } = await getViewer()
  const { error } = await supabase.rpc('remove_friend', { p_user: userId })
  return error ? { ok: false, error: 'Could not remove.' } : ok()
}

/** What one friend sees of you. */
export async function setFriendShare(userId: string, level: 'exact' | 'count' | 'private'): Promise<Result> {
  const p = z.object({ userId: uuid, level: z.enum(['exact', 'count', 'private']) }).safeParse({ userId, level })
  if (!p.success) return { ok: false, error: 'Invalid choice.' }
  const { supabase } = await getViewer()
  const { error } = await supabase.rpc('set_friend_share', { p_user: p.data.userId, p_level: p.data.level })
  return error ? { ok: false, error: 'Could not save.' } : ok()
}

const sharingSchema = z.object({
  shareLevel: z.enum(['exact', 'count', 'private']),
  presenceVisible: z.boolean(),
  invitesMode: z.enum(['allowed', 'online_only', 'off']),
  callLink: z.string().trim().max(500).refine((u) => u === '' || /^https:\/\//.test(u), 'The call link must start with https://'),
})

export async function updateSharing(input: z.input<typeof sharingSchema>): Promise<Result> {
  const p = sharingSchema.safeParse(input)
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Invalid settings.' }
  const { supabase, userId } = await getViewer()
  const { error } = await supabase.from('settings').update({
    share_level: p.data.shareLevel, presence_visible: p.data.presenceVisible, invites_mode: p.data.invitesMode, call_link: p.data.callLink || null,
  }).eq('owner_id', userId)
  return error ? { ok: false, error: 'Could not save.' } : ok()
}

/** Today's choice: solo or with your partner (asked at most once a day, remembered). */
export async function setWorkMode(mode: 'solo' | 'pair'): Promise<Result> {
  if (mode !== 'solo' && mode !== 'pair') return { ok: false, error: 'Invalid choice.' }
  const { supabase, userId, today } = await getViewer()
  const { error } = await supabase.from('settings').update({ work_mode: mode, work_mode_on: today }).eq('owner_id', userId)
  return error ? { ok: false, error: 'Could not save.' } : ok()
}

const INVITE_MSG: Record<string, string> = {
  off: 'They aren’t taking session invites right now.',
  offline_only: 'They only take invites while online.',
  limit: 'You’ve sent a few invites already — give them a moment.',
  no_partner: 'Pick a friend first.',
  not_friends: 'You can only invite your friends.',
  too_many: 'Up to 4 friends at a time.',
  nobody: 'None of them are taking invites right now.',
}

/** Invite one friend (your pair room) or up to four (a group room). The call type applies to everyone in the room. */
export async function sendSessionInvite(minutes: number, friendIds: string[], call: 'video' | 'audio' | 'none' = 'none'): Promise<Out<{ status: string; coSessionId?: string; sent?: number }>> {
  const p = z.object({ minutes: z.number().int().min(10).max(120), friends: z.array(uuid).min(1).max(4), call: z.enum(['video', 'audio', 'none']) }).safeParse({ minutes, friends: friendIds, call })
  if (!p.success) return { ok: false, error: 'Pick 1–4 friends and a length.' }
  const { supabase } = await getViewer()
  const { data, error } = await supabase.rpc('send_session_invite', { p_minutes: p.data.minutes, p_friends: p.data.friends, p_call: p.data.call })
  if (error || !data) return { ok: false, error: 'Could not send the invite.' }
  const r = data as { status: string; co_session_id?: string; sent?: number }
  if (r.status !== 'sent' && r.status !== 'joined') return { ok: false, error: INVITE_MSG[r.status] ?? 'Could not send the invite.' }
  revalidatePath('/', 'layout')
  return { ok: true, status: r.status, coSessionId: r.co_session_id, sent: r.sent }
}

/**
 * Accepting pauses your solo work: a running session is finished (it counts) and remembered,
 * so you can resume the same task after the pair session.
 */
export async function respondSessionInvite(id: string, action: 'accept' | 'snooze' | 'later' | 'decline'): Promise<Out<{ coSessionId?: string; resume?: { taskId: string; title: string; minutes: number } }>> {
  const p = z.object({ id: uuid, action: z.enum(['accept', 'snooze', 'later', 'decline']) }).safeParse({ id, action })
  if (!p.success) return { ok: false, error: 'Invalid request.' }
  const { supabase } = await getViewer()
  let resume: { taskId: string; title: string; minutes: number } | undefined
  if (p.data.action === 'accept') {
    const { data: open } = await supabase.from('sessions').select('id, task_id, tasks(title, first_action)').is('ended_at', null).maybeSingle()
    if (open) {
      const r = await stopSession({ id: open.id, discarded: false })
      if (r.ok) resume = { taskId: open.task_id, title: open.tasks?.first_action || open.tasks?.title || 'your task', minutes: r.activeMinutes }
    }
  }
  const { data, error } = await supabase.rpc('respond_session_invite', { p_id: p.data.id, p_action: p.data.action })
  if (error || !data) return { ok: false, error: 'Could not respond.' }
  const r = data as { status: string; co_session_id?: string }
  if (r.status === 'gone') return { ok: false, error: 'That invite has expired.' }
  revalidatePath('/', 'layout')
  return { ok: true, coSessionId: r.co_session_id, resume }
}

export async function sendReaction(kind: 'clap' | 'strong' | 'nudge', groupId: string, toUser: string): Promise<Result> {
  const p = z.object({ kind: z.enum(['clap', 'strong', 'nudge']), groupId: uuid, toUser: uuid }).safeParse({ kind, groupId, toUser })
  if (!p.success) return { ok: false, error: 'Invalid reaction.' }
  const { supabase } = await getViewer()
  const { error } = await supabase.from('reactions').insert({ group_id: p.data.groupId, to_user: p.data.toUser, kind: p.data.kind })
  return error ? { ok: false, error: 'Could not send.' } : ok()
}

export async function setQuestTarget(groupId: string, hours: number): Promise<Result> {
  const p = z.object({ groupId: uuid, hours: z.number().min(1).max(100) }).safeParse({ groupId, hours })
  if (!p.success) return { ok: false, error: 'Pick 1–100 hours.' }
  const { supabase } = await getViewer()
  const { error } = await supabase.from('groups').update({ quest_minutes: Math.round(p.data.hours * 60) }).eq('id', p.data.groupId)
  return error ? { ok: false, error: 'Could not save.' } : ok()
}

// ───────────── common list (same work, e.g. exam prep) ─────────────

export async function createSharedList(groupId: string, title: string): Promise<Result> {
  const p = z.object({ groupId: uuid, title: z.string().trim().min(1, 'Name the list.').max(80) }).safeParse({ groupId, title })
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? 'Invalid name.' }
  const { supabase } = await getViewer()
  const { error } = await supabase.from('shared_lists').insert({ group_id: p.data.groupId, title: p.data.title })
  return error ? { ok: false, error: 'Could not create the list.' } : ok()
}

export async function acceptSharedList(id: string): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Invalid request.' }
  const { supabase } = await getViewer()
  const { error } = await supabase.rpc('accept_shared_list', { p_id: id })
  return error ? { ok: false, error: 'Could not join the list.' } : ok()
}

export async function addSharedItem(listId: string, title: string): Promise<Result> {
  const p = z.object({ listId: uuid, title: z.string().trim().min(1).max(200) }).safeParse({ listId, title })
  if (!p.success) return { ok: false, error: 'Write something to add.' }
  const { supabase } = await getViewer()
  const { error } = await supabase.from('shared_list_items').insert({ list_id: p.data.listId, title: p.data.title })
  return error ? { ok: false, error: 'Could not add.' } : ok()
}

export async function toggleSharedItem(id: string, done: boolean): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Invalid request.' }
  const { supabase, userId, now } = await getViewer()
  const { error } = await supabase.from('shared_list_items').update(done ? { done_at: now.toISOString(), done_by: userId } : { done_at: null, done_by: null }).eq('id', id)
  return error ? { ok: false, error: 'Could not update.' } : ok()
}

/** A common-list item becomes a personal task so a focus session can run on it. */
export async function taskForSharedItem(title: string): Promise<Out<{ taskId: string }>> {
  const p = z.string().trim().min(1).max(200).safeParse(title)
  if (!p.success) return { ok: false, error: 'Invalid item.' }
  const { supabase, today, now } = await getViewer()
  const { data: existing } = await supabase.from('tasks').select('id').eq('title', p.data).in('status', ['today', 'evening', 'inbox', 'backlog']).limit(1).maybeSingle()
  if (existing) return { ok: true, taskId: existing.id }
  const { data, error } = await supabase.from('tasks').insert({
    title: p.data, first_action: p.data, status: 'backlog', planned_for: today, first_planned_at: now.toISOString(),
  }).select('id').single()
  if (error || !data) return { ok: false, error: 'Could not prepare the task.' }
  return { ok: true, taskId: data.id }
}

/** "Hide from partner" on a single task (overrides the default sharing level). */
export async function setTaskPrivate(id: string, isPrivate: boolean): Promise<Result> {
  if (!uuid.safeParse(id).success) return { ok: false, error: 'Invalid request.' }
  const { supabase } = await getViewer()
  const { error } = await supabase.from('tasks').update({ share_override: isPrivate ? 'private' : null }).eq('id', id)
  return error ? { ok: false, error: 'Could not update.' } : ok()
}
