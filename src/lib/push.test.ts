import { beforeEach, describe, expect, it, vi } from 'vitest'
import webpush from 'web-push'
import { prisma } from '@/lib/db'
import { getWeekBounds, parseDay } from '@/lib/dates'
import { sendDailyReminders, vapidConfig } from '@/lib/push'
import { TEST_USER_ID, createTestUser } from '@/test/session-mock'

vi.mock('web-push', () => ({ default: { sendNotification: vi.fn() } }))
const send = vi.mocked(webpush.sendNotification)

const CONFIG = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:a@b.c' }
const NOW = new Date('2026-10-26T19:00:00-03:00') // Monday, 19h in Brasília

async function planToday(userId: string, done: boolean[], earlierDone = 0) {
  const objective = await prisma.objective.create({ data: { userId, title: 'Obj', startDate: NOW } })
  const goal = await prisma.weeklyGoal.create({
    data: { title: 'Meta', objectiveId: objective.id, ...getWeekBounds(parseDay('2026-10-26')) },
  })
  for (const completed of done) {
    await prisma.dailyTask.create({ data: { title: 'T', weeklyGoalId: goal.id, date: parseDay('2026-10-26'), completed } })
  }
  for (let i = 0; i < earlierDone; i++) {
    await prisma.dailyTask.create({
      data: { title: 'T', weeklyGoalId: goal.id, date: parseDay(`2026-10-${10 + i}`), completed: true },
    })
  }
}

async function subscribe(userId: string, endpoint: string) {
  await prisma.pushSubscription.create({ data: { userId, endpoint, p256dh: 'k', auth: 'a' } })
}

beforeEach(() => {
  send.mockReset()
  send.mockResolvedValue({ statusCode: 201, body: '', headers: {} })
})

describe('vapidConfig', () => {
  it('is off until both keys exist', () => {
    expect(vapidConfig({})).toBeNull()
    expect(vapidConfig({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'pub' })).toBeNull()
    expect(
      vapidConfig({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:x@y.z' }),
    ).toEqual({ publicKey: 'pub', privateKey: 'priv', subject: 'mailto:x@y.z' })
  })
})

describe('sendDailyReminders', () => {
  it('reminds a person whose day is not done yet, with the result within reach', async () => {
    await planToday(TEST_USER_ID, [true, false, false], 3)
    await subscribe(TEST_USER_ID, 'https://push.example.com/1')

    const run = await sendDailyReminders(CONFIG, NOW)

    expect(run).toEqual({ sent: 1, skipped: 0, removed: 0, failed: 0 })
    const [target, payload] = send.mock.calls[0]
    expect(target).toEqual({ endpoint: 'https://push.example.com/1', keys: { p256dh: 'k', auth: 'a' } })
    expect(JSON.parse(payload as string)).toEqual({
      title: 'Metas',
      body: 'Mais 1 tarefa e hoje vira seu 4º dia feito.',
      url: '/',
    })
  })

  it('stays quiet for a done day and for a day without tasks', async () => {
    await planToday(TEST_USER_ID, [true, true, false])
    await subscribe(TEST_USER_ID, 'https://push.example.com/1')
    await createTestUser('idle')
    await subscribe('idle', 'https://push.example.com/2')

    expect(await sendDailyReminders(CONFIG, NOW)).toEqual({ sent: 0, skipped: 2, removed: 0, failed: 0 })
    expect(send).not.toHaveBeenCalled()
  })

  it('forgets browsers the push service reports as gone, and counts other failures', async () => {
    await planToday(TEST_USER_ID, [false])
    await subscribe(TEST_USER_ID, 'https://push.example.com/gone')
    await subscribe(TEST_USER_ID, 'https://push.example.com/flaky')
    send.mockImplementation(async (target) => {
      throw Object.assign(new Error('push failed'), { statusCode: target.endpoint.endsWith('gone') ? 410 : 500 })
    })

    expect(await sendDailyReminders(CONFIG, NOW)).toEqual({ sent: 0, skipped: 0, removed: 1, failed: 1 })
    expect(await prisma.pushSubscription.findMany({ select: { endpoint: true } })).toEqual([
      { endpoint: 'https://push.example.com/flaky' },
    ])
  })
})
