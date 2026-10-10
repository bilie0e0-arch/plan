/* Plan service worker: push notifications + offline fallback (DESIGN F58, §10.7). */
const CACHE = 'plan-v1'
const OFFLINE_URL = '/offline'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE_URL, '/icons/icon-192.png'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

// Navigations: network first, fall back to the last cached copy of that page, then the offline page.
// Static assets: cache first (they are content-hashed).
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(OFFLINE_URL))),
    )
    return
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
        return res
      })),
    )
  }
})

self.addEventListener('push', (event) => {
  let data = { title: 'Plan', body: '', url: '/', tag: 'plan' }
  try { data = { ...data, ...event.data.json() } } catch { /* plain text push */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, tag: data.tag, data: { url: data.url }, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', renotify: true,
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(target); return c.focus() }
      }
      return self.clients.openWindow(target)
    }),
  )
})
