import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import {
  clientIp,
  GUEST_GLOBAL_LIMIT,
  GUEST_IP_LIMIT,
  GUEST_IP_WINDOW_MS,
  isGuestCreationThrottled,
} from '@/lib/guest/throttle'

const NOW = new Date(2026, 9, 7, 15)

async function guest(id: string, opts: { ip?: string; isAnonymous?: boolean; ageMs?: number } = {}) {
  const createdAt = new Date(NOW.getTime() - (opts.ageMs ?? 1000))
  await prisma.user.create({
    data: { id, name: id, email: `${id}@example.com`, isAnonymous: opts.isAnonymous ?? true, createdAt },
  })
  await prisma.session.create({
    data: {
      id: `s-${id}`, token: `t-${id}`, userId: id, createdAt,
      expiresAt: new Date(NOW.getTime() + 3600_000), ipAddress: opts.ip ?? null,
    },
  })
}

describe('clientIp', () => {
  it('uses the first x-forwarded-for entry', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4')
  })
  it('is null without the header', () => {
    expect(clientIp(new Headers())).toBeNull()
  })
})

describe('isGuestCreationThrottled', () => {
  it('allows an IP under the limit and blocks it at the limit', async () => {
    for (let i = 0; i < GUEST_IP_LIMIT - 1; i++) await guest(`g${i}`, { ip: '1.1.1.1' })
    expect(await isGuestCreationThrottled('1.1.1.1', NOW)).toBe(false)
    await guest('g-last', { ip: '1.1.1.1' })
    expect(await isGuestCreationThrottled('1.1.1.1', NOW)).toBe(true)
    expect(await isGuestCreationThrottled('2.2.2.2', NOW)).toBe(false)
  })

  it('ignores old sessions and real accounts for the per-IP count', async () => {
    for (let i = 0; i < GUEST_IP_LIMIT; i++) await guest(`old${i}`, { ip: '1.1.1.1', ageMs: GUEST_IP_WINDOW_MS + 1000 })
    for (let i = 0; i < GUEST_IP_LIMIT; i++) await guest(`real${i}`, { ip: '1.1.1.1', isAnonymous: false })
    expect(await isGuestCreationThrottled('1.1.1.1', NOW)).toBe(false)
  })

  it('blocks globally at the per-minute limit, whatever the IP', async () => {
    for (let i = 0; i < GUEST_GLOBAL_LIMIT - 1; i++) await guest(`u${i}`, { ip: `9.9.${i}.1` })
    expect(await isGuestCreationThrottled('7.7.7.7', NOW)).toBe(false)
    await guest('u-last', { ip: '9.9.99.1' })
    expect(await isGuestCreationThrottled('7.7.7.7', NOW)).toBe(true)
  })

  it('skips the per-IP check without an IP but still applies the global one', async () => {
    for (let i = 0; i < GUEST_IP_LIMIT; i++) await guest(`n${i}`, { ip: '1.1.1.1' })
    expect(await isGuestCreationThrottled(null, NOW)).toBe(false)
    for (let i = 0; i < GUEST_GLOBAL_LIMIT; i++) await guest(`m${i}`)
    expect(await isGuestCreationThrottled(null, NOW)).toBe(true)
  })
})
