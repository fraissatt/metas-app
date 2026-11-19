// @vitest-environment node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

type Handler = (event: Record<string, unknown>) => void

/** A tiny Cache Storage: enough for the worker's match/open/put/addAll/keys/delete. */
function fakeCaches(initial: Record<string, Record<string, unknown>> = {}) {
  const stores = new Map(Object.entries(initial).map(([name, entries]) => [name, new Map(Object.entries(entries))]))
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const store = stores.get(name)!
    return {
      put: async (request: { url: string } | string, response: unknown) =>
        void store.set(typeof request === 'string' ? request : new URL(request.url).pathname, response),
      addAll: async (urls: string[]) => urls.forEach((url) => store.set(url, `precached:${url}`)),
    }
  }
  return {
    stores,
    caches: {
      open,
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
      match: async (request: { url: string } | string) => {
        const key = typeof request === 'string' ? request : new URL(request.url).pathname
        for (const store of stores.values()) if (store.has(key)) return store.get(key)
        return undefined
      },
    },
  }
}

function loadWorker({
  hostname = 'metas.example',
  fetchImpl = vi.fn(async () => ({ ok: true, clone() { return this } })),
  caches = fakeCaches(),
}: { hostname?: string; fetchImpl?: ReturnType<typeof vi.fn>; caches?: ReturnType<typeof fakeCaches> } = {}) {
  const handlers: Record<string, Handler> = {}
  const self = {
    location: { origin: 'https://metas.example', hostname },
    addEventListener: (type: string, handler: Handler) => (handlers[type] = handler),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => {}) },
  }
  runInNewContext(readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8'), {
    self,
    URL,
    Promise,
    caches: caches.caches,
    fetch: fetchImpl,
  })
  return { handlers, self, fetchImpl, store: caches }
}

function fetchEvent(url: string, init: { method?: string; mode?: string } = {}) {
  let response: Promise<unknown> | undefined
  return {
    request: { url, method: init.method ?? 'GET', mode: init.mode ?? 'no-cors' },
    respondWith: (promise: Promise<unknown>) => (response = Promise.resolve(promise)),
    get response() {
      return response
    },
  }
}

describe('service worker, offline layer', () => {
  it('precaches the offline page and the icon on install, and takes over at once', async () => {
    const { handlers, self, store } = loadWorker()
    const pending: Promise<unknown>[] = []
    handlers.install({ waitUntil: (p: Promise<unknown>) => pending.push(p) })
    await Promise.all(pending)

    expect([...store.stores.get('metas-static-v1')!.keys()]).toEqual(['/offline.html', '/icons/icon-192.png'])
    expect(self.skipWaiting).toHaveBeenCalled()
  })

  it('drops caches of older versions on activate', async () => {
    const { handlers, store } = loadWorker({ caches: fakeCaches({ 'metas-static-v1': {}, 'metas-old': {} }) })
    const pending: Promise<unknown>[] = []
    handlers.activate({ waitUntil: (p: Promise<unknown>) => pending.push(p) })
    await Promise.all(pending)
    expect([...store.stores.keys()]).toEqual(['metas-static-v1'])
  })

  it('shows the offline page when a page load has no network, and the real page when it has', async () => {
    const down = loadWorker({
      fetchImpl: vi.fn(async () => {
        throw new TypeError('offline')
      }),
      caches: fakeCaches({ 'metas-static-v1': { '/offline.html': 'OFFLINE PAGE' } }),
    })
    const offline = fetchEvent('https://metas.example/objectives', { mode: 'navigate' })
    down.handlers.fetch(offline)
    expect(await offline.response).toBe('OFFLINE PAGE')

    const upResponse = { ok: true }
    const up = loadWorker({ fetchImpl: vi.fn(async () => upResponse) })
    const online = fetchEvent('https://metas.example/objectives', { mode: 'navigate' })
    up.handlers.fetch(online)
    expect(await online.response).toBe(upResponse)
  })

  it('serves hashed static files from the cache after the first fetch', async () => {
    const response = { ok: true, clone() { return this } }
    const { handlers, fetchImpl } = loadWorker({ fetchImpl: vi.fn(async () => response) })
    const url = 'https://metas.example/_next/static/chunks/app-abc123.js'

    const first = fetchEvent(url)
    handlers.fetch(first)
    expect(await first.response).toBe(response)
    await new Promise((resolve) => setTimeout(resolve, 0))

    const second = fetchEvent(url)
    handlers.fetch(second)
    expect(await second.response).toBe(response)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('does not cache failed responses', async () => {
    const failing = { ok: false, clone() { return this } }
    const { handlers, store } = loadWorker({ fetchImpl: vi.fn(async () => failing) })
    const event = fetchEvent('https://metas.example/_next/static/chunks/missing.js')
    handlers.fetch(event)
    await event.response
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.stores.get('metas-static-v1')?.has('/_next/static/chunks/missing.js') ?? false).toBe(false)
  })

  it('leaves data, writes, other sites and router fetches alone', () => {
    const { handlers } = loadWorker()
    for (const event of [
      fetchEvent('https://metas.example/objectives', { method: 'POST' }),
      fetchEvent('https://metas.example/api/auth/get-session'),
      fetchEvent('https://metas.example/objectives'), // a router (RSC) fetch: not a navigation
      fetchEvent('https://other.example/_next/static/x.js'),
    ]) {
      handlers.fetch(event)
      expect(event.response).toBeUndefined()
    }
  })

  it('does nothing on localhost, where file names are not hashed', () => {
    const { handlers } = loadWorker({ hostname: 'localhost' })
    const event = fetchEvent('https://metas.example/_next/static/chunks/app.js')
    handlers.fetch(event)
    expect(event.response).toBeUndefined()
  })
})
