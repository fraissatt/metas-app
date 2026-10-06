import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'

const redirect = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

const signInAnonymous = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth', () => ({ auth: { api: { signInAnonymous } } }))

const cleanupGuests = vi.hoisted(() => vi.fn())
vi.mock('@/lib/guest/cleanup', () => ({ cleanupGuests }))

const { enterAsGuest } = await import('@/lib/actions/guest')

beforeEach(() => {
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
})
