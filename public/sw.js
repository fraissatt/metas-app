// Metas service worker: only the daily reminder. No caching or offline mode,
// so the app is always the deployed version.

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
