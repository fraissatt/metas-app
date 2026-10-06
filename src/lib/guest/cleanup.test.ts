import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { cleanupGuests, GUEST_IDLE_MS, MAX_GUESTS } from '@/lib/guest/cleanup'

const NOW = new Date(2026, 9, 7, 15)

async function user(id: string, isAnonymous: boolean, idleMs: number) {
  await prisma.user.create({
    data: { id, name: id, email: `${id}@example.com`, isAnonymous, lastSeenAt: new Date(NOW.getTime() - idleMs) },
  })
}

describe('cleanupGuests', () => {
  it('deletes guests idle for more than 24 h, with their data, and keeps active guests', async () => {
    await user('old', true, GUEST_IDLE_MS + 60_000)
    await user('fresh', true, GUEST_IDLE_MS - 60_000)
    await prisma.objective.create({ data: { title: 'O', startDate: NOW, userId: 'old' } })

    expect(await cleanupGuests(NOW)).toBe(1)
    expect(await prisma.user.findUnique({ where: { id: 'old' } })).toBeNull()
    expect(await prisma.user.findUnique({ where: { id: 'fresh' } })).not.toBeNull()
    expect(await prisma.objective.count({ where: { userId: 'old' } })).toBe(0)
  })

  it('never deletes real accounts, however idle', async () => {
    await user('real', false, 365 * 24 * 3600_000)
    await cleanupGuests(NOW)
    expect(await prisma.user.findUnique({ where: { id: 'real' } })).not.toBeNull()
  })

  it('keeps room for one more guest under the cap, removing the least recently seen', async () => {
    for (let i = 0; i < MAX_GUESTS; i++) await user(`g${String(i).padStart(3, '0')}`, true, i * 1000)
    // g000 is the most recent, g199 the least recent.
    expect(await cleanupGuests(NOW)).toBe(1)
    expect(await prisma.user.count({ where: { isAnonymous: true } })).toBe(MAX_GUESTS - 1)
    expect(await prisma.user.findUnique({ where: { id: 'g199' } })).toBeNull()
  })
})
