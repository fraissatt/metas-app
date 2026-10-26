// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

type Handler = (event: Record<string, unknown>) => void

/** Runs public/sw.js against a fake worker scope and returns its listeners. */
function loadWorker(windows: Array<{ url: string; focus: () => Promise<unknown> }> = []) {
  const handlers: Record<string, Handler> = {}
  const self = {
    location: { origin: 'https://metas.example' },
    addEventListener: (type: string, handler: Handler) => (handlers[type] = handler),
    registration: { showNotification: vi.fn(async () => {}) },
    clients: { matchAll: vi.fn(async () => windows), openWindow: vi.fn(async () => null) },
  }
  runInNewContext(readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8'), { self, URL })
  return { self, handlers }
}

function waitUntilCollector() {
  const pending: Promise<unknown>[] = []
  return { pending, waitUntil: (promise: Promise<unknown>) => pending.push(promise) }
}

describe('service worker', () => {
  it('shows the reminder the server sends, as one replaceable notification', async () => {
    const { self, handlers } = loadWorker()
    const { pending, waitUntil } = waitUntilCollector()
    const payload = { title: 'Metas', body: 'Mais 1 tarefa e hoje vira seu 4º dia feito.', url: '/' }

    handlers.push({ data: { json: () => payload }, waitUntil })
    await Promise.all(pending)

    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Metas',
      expect.objectContaining({ body: payload.body, tag: 'lembrete-diario', data: { url: '/' } }),
    )
  })

  it('still shows something when the payload is malformed', async () => {
    const { self, handlers } = loadWorker()
    const { pending, waitUntil } = waitUntilCollector()

    handlers.push({ data: { json: () => JSON.parse('not json') }, waitUntil })
    await Promise.all(pending)

    expect(self.registration.showNotification).toHaveBeenCalledWith('Metas', expect.anything())
  })

  it('brings an open app window to Hoje on click, or opens one', async () => {
    const navigate = vi.fn(async () => null)
    const client = { url: 'https://metas.example/objectives', navigate }
    const open = { url: client.url, focus: vi.fn(async () => client) }
    const withWindow = loadWorker([open])
    const first = waitUntilCollector()
    const close = vi.fn()

    withWindow.handlers.notificationclick({ notification: { close, data: { url: '/' } }, waitUntil: first.waitUntil })
    await Promise.all(first.pending)

    expect(close).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('https://metas.example/')
    expect(withWindow.self.clients.openWindow).not.toHaveBeenCalled()

    const empty = loadWorker()
    const second = waitUntilCollector()
    empty.handlers.notificationclick({ notification: { close, data: { url: '/' } }, waitUntil: second.waitUntil })
    await Promise.all(second.pending)

    expect(empty.self.clients.openWindow).toHaveBeenCalledWith('https://metas.example/')
  })
})
