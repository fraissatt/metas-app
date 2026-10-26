import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { removeReminderSubscription, saveReminderSubscription } from '@/lib/actions/reminders'
import { TEST_USER_ID, actAs, createTestUser } from '@/test/session-mock'

const browser = (endpoint = 'https://push.example.com/abc') => ({ endpoint, keys: { p256dh: 'key', auth: 'secret' } })

describe('reminder subscriptions', () => {
  it('saves this browser for the current user', async () => {
    await saveReminderSubscription(browser())
    expect(await prisma.pushSubscription.findMany({ select: { userId: true, endpoint: true } })).toEqual([
      { userId: TEST_USER_ID, endpoint: 'https://push.example.com/abc' },
    ])
  })

  it('moves the browser to whoever signs in on it, without duplicating', async () => {
    await saveReminderSubscription(browser())
    actAs(await createTestUser('other'))
    await saveReminderSubscription(browser())

    expect(await prisma.pushSubscription.findMany({ select: { userId: true } })).toEqual([{ userId: 'other' }])
  })

  it('rejects malformed subscriptions', async () => {
    await expect(
      saveReminderSubscription({ endpoint: 'http://insecure.example.com', keys: { p256dh: 'k', auth: 'a' } }),
    ).rejects.toThrow()
    await expect(saveReminderSubscription({ endpoint: 'https://push.example.com/x', keys: {} })).rejects.toThrow()
    await expect(saveReminderSubscription({ endpoint: 42 })).rejects.toThrow()
    expect(await prisma.pushSubscription.count()).toBe(0)
  })

  it('removes only the browser of the signed-in user', async () => {
    await saveReminderSubscription(browser())
    const owner = { id: TEST_USER_ID, name: TEST_USER_ID, email: `${TEST_USER_ID}@example.com`, isAnonymous: false }
    actAs(await createTestUser('other'))
    await removeReminderSubscription('https://push.example.com/abc')
    expect(await prisma.pushSubscription.count()).toBe(1)

    actAs(owner)
    await removeReminderSubscription('https://push.example.com/abc')
    expect(await prisma.pushSubscription.count()).toBe(0)
  })
})
