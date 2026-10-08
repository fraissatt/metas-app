import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { GUEST_IP_LIMIT } from '@/lib/guest/throttle'

const redirect = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ redirect }))
const requestHeaders = vi.hoisted(() => ({ value: {} as Record<string, string> }))
vi.mock('next/headers', () => ({ headers: async () => new Headers(requestHeaders.value) }))

const signInAnonymous = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth', () => ({ auth: { api: { signInAnonymous } } }))

const cleanupGuests = vi.hoisted(() => vi.fn())
vi.mock('@/lib/guest/cleanup', () => ({ cleanupGuests }))

const seed = await vi.importActual<typeof import('@/lib/guest/seed')>('@/lib/guest/seed')
const seedDemoData = vi.hoisted(() => vi.fn())
vi.mock('@/lib/guest/seed', () => ({ seedDemoData }))

const { enterAsGuest } = await import('@/lib/actions/guest')

beforeEach(() => {
  requestHeaders.value = {}
  seedDemoData.mockReset().mockImplementation(seed.seedDemoData)
  redirect.mockClear()
  cleanupGuests.mockReset().mockResolvedValue(0)
  signInAnonymous.mockReset().mockImplementation(async () => {
    const user = await prisma.user.create({
      data: { id: 'anon-1', name: 'Visitante', email: 'anon-1@example.com', isAnonymous: true },
    })
    return { token: 't', user }
  })
})

describe('enterAsGuest', () => {
  it('refuses when the IP already created too many guests, without creating a user', async () => {
    const recent = new Date()
    for (let i = 0; i < GUEST_IP_LIMIT; i++) {
      await prisma.user.create({ data: { id: `prev${i}`, name: 'V', email: `prev${i}@example.com`, isAnonymous: true } })
      await prisma.session.create({
        data: { id: `ps${i}`, token: `pt${i}`, userId: `prev${i}`, expiresAt: new Date(recent.getTime() + 3600_000), ipAddress: '5.5.5.5', createdAt: recent },
      })
    }
    requestHeaders.value = { 'x-forwarded-for': '5.5.5.5' }
    // A returned result, not a thrown error: Next hides Server Action error messages in production.
    await expect(enterAsGuest()).resolves.toEqual({ throttled: true })
    expect(signInAnonymous).not.toHaveBeenCalled()
    expect(cleanupGuests).not.toHaveBeenCalled()
    expect(await prisma.user.findUnique({ where: { id: 'anon-1' } })).toBeNull()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('cleans up, signs in anonymously, seeds the demo and goes home', async () => {
    await enterAsGuest()
    expect(cleanupGuests.mock.invocationCallOrder[0]).toBeLessThan(signInAnonymous.mock.invocationCallOrder[0])
    expect(await prisma.objective.count({ where: { userId: 'anon-1' } })).toBe(3)
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('still creates the guest when cleanup fails', async () => {
    cleanupGuests.mockRejectedValue(new Error('db hiccup'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await enterAsGuest()
    expect(await prisma.objective.count({ where: { userId: 'anon-1' } })).toBe(3)
  })

  it('removes the new guest and rejects when seeding fails', async () => {
    seedDemoData.mockRejectedValueOnce(new Error('seed boom'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(enterAsGuest()).rejects.toThrow('Não foi possível concluir. Tente de novo.')
    expect(await prisma.user.findUnique({ where: { id: 'anon-1' } })).toBeNull()
    expect(redirect).not.toHaveBeenCalled()
  })
})
