import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { removeReminderSubscription, saveReminderSubscription } from '@/lib/actions/reminders'
import { MAX_SUBSCRIPTIONS_PER_USER } from '@/lib/push-endpoint'
import { TEST_USER_ID, actAs, createTestUser } from '@/test/session-mock'

const browser = (endpoint = 'https://fcm.googleapis.com/fcm/send/abc') => ({ endpoint, keys: { p256dh: 'key', auth: 'secret' } })

describe('reminder subscriptions', () => {
  it('saves this browser for the current user', async () => {
    await saveReminderSubscription(browser())
    expect(await prisma.pushSubscription.findMany({ select: { userId: true, endpoint: true } })).toEqual([
      { userId: TEST_USER_ID, endpoint: 'https://fcm.googleapis.com/fcm/send/abc' },
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
    await expect(saveReminderSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: {} })).rejects.toThrow()
    await expect(saveReminderSubscription({ endpoint: 42 })).rejects.toThrow()
    expect(await prisma.pushSubscription.count()).toBe(0)
  })

  it('only accepts the browsers\' push services, so the server never calls other hosts', async () => {
    for (const endpoint of [
      'https://attacker.example.com/hook',
      'https://169.254.169.254/latest/meta-data',
      'https://fcm.googleapis.com.attacker.example/x',
      'https://fcm.googleapis.com:8443/x',
      'https://user:pass@fcm.googleapis.com/x',
    ]) {
      await expect(saveReminderSubscription(browser(endpoint))).rejects.toThrow('Inscrição inválida.')
    }
    expect(await prisma.pushSubscription.count()).toBe(0)
  })

  it('keeps at most the newest browsers of one account', async () => {
    for (let i = 0; i <= MAX_SUBSCRIPTIONS_PER_USER; i++) {
      await saveReminderSubscription(browser(`https://fcm.googleapis.com/fcm/send/device-${i}`))
    }
    const rows = await prisma.pushSubscription.findMany({ select: { endpoint: true } })
    expect(rows).toHaveLength(MAX_SUBSCRIPTIONS_PER_USER)
    expect(rows.map((row) => row.endpoint)).not.toContain('https://fcm.googleapis.com/fcm/send/device-0')
  })

  it('removes only the browser of the signed-in user', async () => {
    await saveReminderSubscription(browser())
    const owner = { id: TEST_USER_ID, name: TEST_USER_ID, email: `${TEST_USER_ID}@example.com`, isAnonymous: false }
    actAs(await createTestUser('other'))
    await removeReminderSubscription('https://fcm.googleapis.com/fcm/send/abc')
    expect(await prisma.pushSubscription.count()).toBe(1)

    actAs(owner)
    await removeReminderSubscription('https://fcm.googleapis.com/fcm/send/abc')
    expect(await prisma.pushSubscription.count()).toBe(0)
  })
})
