/**
 * Before signing out on this device: drop cached pages and unsubscribe this browser from push,
 * so the next person using the device never sees the previous user's pages or block notifications.
 */
export async function clearDevice(): Promise<void> {
  try {
    if ('caches' in window) await caches.delete('plan-v1')
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    const sub = await reg?.pushManager?.getSubscription()
    await Promise.race([sub?.unsubscribe(), new Promise((r) => setTimeout(r, 1500))])
  } catch {
    // Best effort: signing out must never be blocked.
  }
}
