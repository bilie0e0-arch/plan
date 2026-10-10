import 'server-only'
import webpush from 'web-push'

let configured = false
function configure(): boolean {
  if (configured) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv)
  configured = true
  return true
}

export interface PushPayload { title: string; body: string; url: string; tag: string }

/** Sends to one subscription. Returns 'gone' when the browser revoked it (caller should delete it). */
export async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: PushPayload): Promise<'sent' | 'gone' | 'failed'> {
  if (!configure()) return 'failed'
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 300 })
    return 'sent'
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode
    return code === 404 || code === 410 ? 'gone' : 'failed'
  }
}
