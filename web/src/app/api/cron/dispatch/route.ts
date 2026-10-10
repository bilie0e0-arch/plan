import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/push'
import { dueEscalation, inQuietHours } from '@/domain/calendar/blocks'
import { dayKey, localHour } from '@/domain/time/day'

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const got = req.headers.get('x-cron-secret')
  if (!secret || !got || got.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret))
}

/**
 * Called every minute by the database scheduler (pg_cron → pg_net).
 * Block-start pushes at T0 and +5 min (max two per block), honouring quiet hours,
 * focus protection and de-duplication (DESIGN §10.7–10.8). Hourly: audio retention cleanup.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const now = new Date()
  const from = new Date(now.getTime() - 16 * 60_000).toISOString()
  const to = new Date(now.getTime() + 6 * 60_000).toISOString()

  const { data: blocks } = await admin.from('calendar_blocks')
    .select('id, owner_id, title, start_at, sessions(id)')
    .in('status', ['planned', 'committed']).not('type', 'in', '(fixed,buffer)')
    .gte('start_at', from).lte('start_at', to)

  let sent = 0
  if (blocks?.length) {
    const owners = [...new Set(blocks.map((b) => b.owner_id))]
    const [{ data: settings }, { data: profiles }, { data: subs }, { data: open }] = await Promise.all([
      admin.from('settings').select('owner_id, push_enabled, quiet_start_hour, quiet_end_hour').in('owner_id', owners),
      admin.from('profiles').select('user_id, timezone, day_boundary_hour').in('user_id', owners),
      admin.from('push_subscriptions').select('id, owner_id, endpoint, p256dh, auth').in('owner_id', owners),
      admin.from('sessions').select('owner_id').is('ended_at', null).in('owner_id', owners),
    ])
    const focused = new Set((open ?? []).map((o) => o.owner_id))
    for (const b of blocks) {
      const step = dueEscalation(new Date(b.start_at), now, b.sessions.length > 0)
      if (step !== 't0' && step !== 'plus5') continue
      const s = settings?.find((x) => x.owner_id === b.owner_id)
      const p = profiles?.find((x) => x.user_id === b.owner_id)
      if (!s?.push_enabled || !p || focused.has(b.owner_id)) continue
      if (inQuietHours(localHour(now, p.timezone), s.quiet_start_hour, s.quiet_end_hour)) continue
      const { error: dupe } = await admin.from('guide_prompts').insert({
        owner_id: b.owner_id, type: `block_${step}:${b.id}`, shown_on: dayKey(now, p.timezone, p.day_boundary_hour),
      })
      if (dupe) continue
      const payload = step === 't0'
        ? { title: b.title, body: 'Your block is ready when you are.', url: `/launch/${b.id}`, tag: `block-${b.id}` }
        : { title: b.title, body: 'Started 5 minutes ago. Still on? Start 5 minutes, or move it.', url: `/launch/${b.id}`, tag: `block-${b.id}` }
      for (const sub of (subs ?? []).filter((x) => x.owner_id === b.owner_id)) {
        const r = await sendPush(sub, payload)
        if (r === 'gone') await admin.from('push_subscriptions').delete().eq('id', sub.id)
        if (r === 'sent') sent++
      }
    }
  }

  // Partner session invites: push only when the invitee isn't in the app (the in-app card covers that),
  // never during their focus or quiet hours, at most once per invite.
  const { data: invites } = await admin.from('session_invites').select('id, from_user, to_user, minutes')
    .eq('status', 'pending').is('pushed_at', null).gt('expires_at', now.toISOString()).limit(200)
  if (invites?.length) {
    const people = [...new Set(invites.flatMap((i) => [i.from_user, i.to_user]))]
    const [{ data: pres }, { data: settings }, { data: profiles }, { data: subs }] = await Promise.all([
      admin.from('presence').select('user_id, status, updated_at').in('user_id', people),
      admin.from('settings').select('owner_id, push_enabled, quiet_start_hour, quiet_end_hour').in('owner_id', people),
      admin.from('profiles').select('user_id, username, display_name, timezone').in('user_id', people),
      admin.from('push_subscriptions').select('id, owner_id, endpoint, p256dh, auth').in('owner_id', people),
    ])
    for (const i of invites) {
      const p = pres?.find((x) => x.user_id === i.to_user)
      const active = p && now.getTime() - new Date(p.updated_at).getTime() < 60_000
      if (active && p.status !== 'focus') continue // in the app: the invite card shows; leave it unpushed
      if (active && p.status === 'focus') continue // focusing: held until they finish
      await admin.from('session_invites').update({ pushed_at: now.toISOString() }).eq('id', i.id)
      const st = settings?.find((x) => x.owner_id === i.to_user)
      const to = profiles?.find((x) => x.user_id === i.to_user)
      const from = profiles?.find((x) => x.user_id === i.from_user)
      if (!st?.push_enabled || !to || inQuietHours(localHour(now, to.timezone), st.quiet_start_hour, st.quiet_end_hour)) continue
      const who = from?.display_name || `@${from?.username ?? 'your partner'}`
      for (const sub of (subs ?? []).filter((x) => x.owner_id === i.to_user)) {
        const r = await sendPush(sub, { title: `${who}: focus together?`, body: `${i.minutes} minutes, now. Open Plan to join.`, url: '/', tag: `invite-${i.id}` })
        if (r === 'gone') await admin.from('push_subscriptions').delete().eq('id', sub.id)
        if (r === 'sent') sent++
      }
    }
  }

  if (now.getUTCMinutes() === 0) {
    const { data: rs } = await admin.from('settings').select('owner_id, audio_retention_days').not('audio_retention_days', 'is', null)
    for (const r of rs ?? []) {
      const cutoff = new Date(now.getTime() - r.audio_retention_days! * 86_400_000).toISOString()
      const { data: old } = await admin.from('recordings').select('id, audio_path').eq('owner_id', r.owner_id)
        .eq('is_milestone', false).is('audio_deleted_at', null).not('audio_path', 'is', null).lt('recorded_at', cutoff).limit(200)
      if (old?.length) {
        await admin.storage.from('recordings').remove(old.map((o) => o.audio_path!))
        await admin.from('recordings').update({ audio_deleted_at: now.toISOString() }).in('id', old.map((o) => o.id))
      }
    }
  }
  return NextResponse.json({ ok: true, sent })
}
