// Metas service worker: the daily reminder, plus a light offline layer.
//
// What the offline layer does, and what it deliberately does not:
//  - It keeps the app's own static files (hashed JS/CSS under /_next/static/ and
//    the icons) so the app opens faster and its shell survives a bad connection.
//  - When a page cannot be reached, it shows /offline.html, a static page that
//    carries nothing about the person.
//  - It never stores pages or data and never queues writes. The goals live in
//    Postgres behind Server Actions: a cached page would show stale goals, and
//    a replayed write could clash with a change made on another device.

const STATIC_CACHE = 'metas-static-v1'
const OFFLINE_URL = '/offline.html'
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png']

// In local development these file names are not hashed, so a cache would serve old code.
const isLocalDev = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname)

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== STATIC_CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (isLocalDev || request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // A full page load that fails (no network): the offline page. Fetches the
  // router makes for client-side navigation are not "navigate" requests, so
  // they are left to fail normally and the router falls back to a full load.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)))
    return
  }

  // Files whose name changes whenever their content does: safe to keep forever.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
  }
})

self.addEventListener('push', (event) => {
  let message = {}
  try {
    message = event.data ? event.data.json() : {}
  } catch {
    // A malformed payload still shows something rather than nothing.
  }
  const { title = 'Metas', body = 'Veja suas tarefas de hoje.', url = '/' } = message
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // One reminder at a time: a newer one replaces the last.
      tag: 'lembrete-diario',
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // An open app window is brought forward (and taken to Hoje) rather
      // than opening a second one.
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (!open) return self.clients.openWindow(url)
      return open.focus().then((client) => client.navigate(url).catch(() => client))
    }),
  )
})
