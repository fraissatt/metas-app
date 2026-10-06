import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'

vi.unmock('@/lib/session')

const getSession = vi.hoisted(() => vi.fn())
const redirect = vi.hoisted(() => vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`) }))
const cookieHeader = vi.hoisted(() => ({ value: '' }))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(cookieHeader.value ? { cookie: cookieHeader.value } : {}),
}))
// React's cache() is a no-op outside a request in tests; keep the real one.

const { getCurrentUser, requireUser } = await import('@/lib/session')

async function makeUser(id: string, isAnonymous: boolean, lastSeenAt: Date) {
  return prisma.user.create({
    data: { id, name: id, email: `${id}@example.com`, isAnonymous, lastSeenAt },
  })
}

beforeEach(() => {
  getSession.mockReset()
  redirect.mockClear()
  cookieHeader.value = ''
})

describe('getCurrentUser', () => {
  it('returns null without a session', async () => {
    getSession.mockResolvedValue(null)
    expect(await getCurrentUser()).toBeNull()
  })

  it('returns the session user', async () => {
    const u = await makeUser('u1', false, new Date())
    getSession.mockResolvedValue({ user: { ...u } })
    expect(await getCurrentUser()).toEqual({ id: 'u1', name: 'u1', email: 'u1@example.com', isAnonymous: false })
  })

  it('bumps lastSeenAt for a guest seen more than an hour ago', async () => {
    const old = new Date(Date.now() - 2 * 3600_000)
    const u = await makeUser('g1', true, old)
    getSession.mockResolvedValue({ user: { ...u } })
    await getCurrentUser()
    const after = await prisma.user.findUniqueOrThrow({ where: { id: 'g1' } })
    expect(after.lastSeenAt.getTime()).toBeGreaterThan(old.getTime())
  })

  it('does not write when the guest was seen within the hour', async () => {
    const recent = new Date(Date.now() - 10 * 60_000)
    const u = await makeUser('g2', true, recent)
    getSession.mockResolvedValue({ user: { ...u } })
    await getCurrentUser()
    const after = await prisma.user.findUniqueOrThrow({ where: { id: 'g2' } })
    expect(after.lastSeenAt.getTime()).toBe(recent.getTime())
  })
})

describe('requireUser', () => {
  it('redirects to /entrar without a session cookie', async () => {
    getSession.mockResolvedValue(null)
    await expect(requireUser()).rejects.toThrow('REDIRECT /entrar')
  })

  it('redirects to /entrar?expirado=1 when a cookie exists but the session is gone', async () => {
    getSession.mockResolvedValue(null)
    cookieHeader.value = 'better-auth.session_token=abc'
    await expect(requireUser()).rejects.toThrow('REDIRECT /entrar?expirado=1')
  })
})
