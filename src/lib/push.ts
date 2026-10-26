import webpush from 'web-push'
import { prisma } from '@/lib/db'
import { addAppDays, appToday } from '@/lib/dates'
import { countDaysDone, type TaskDay } from '@/lib/day-dots'
import { buildReminder } from '@/lib/reminder'

// Sending the daily reminder. A plain server module, not 'use server': only
// the cron route calls it.

type VapidConfig = { publicKey: string; privateKey: string; subject: string }

/** The keys that sign pushes, or null while they are not configured (the feature stays off). */
export function vapidConfig(env: Record<string, string | undefined> = process.env): VapidConfig | null {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject: env.VAPID_SUBJECT || 'mailto:metas@example.com' }
}

/** The push service says this browser is gone for good (unsubscribed or expired). */
function isGone(error: unknown): boolean {
  const status = (error as { statusCode?: number } | null)?.statusCode
  return status === 404 || status === 410
}

export type ReminderRun = { sent: number; skipped: number; removed: number; failed: number }

/**
 * Sends today's reminder to every subscribed browser whose owner still has a
 * day to make: tasks planned for today (in Brasília) and below the done-day
 * threshold. Browsers the push service reports as gone are deleted.
 */
export async function sendDailyReminders(config: VapidConfig, now: Date = new Date()): Promise<ReminderRun> {
  const subscriptions = await prisma.pushSubscription.findMany()
  const run: ReminderRun = { sent: 0, skipped: 0, removed: 0, failed: 0 }
  if (subscriptions.length === 0) return run

  const today = appToday(now)
  const tomorrow = addAppDays(today, 1)
  const userIds = [...new Set(subscriptions.map((subscription) => subscription.userId))]
  const tasks = await prisma.dailyTask.findMany({
    where: { date: { lt: tomorrow }, weeklyGoal: { objective: { userId: { in: userIds } } } },
    select: { date: true, completed: true, weeklyGoal: { select: { objective: { select: { userId: true } } } } },
  })

  const byUser = new Map<string, { today: TaskDay[]; before: TaskDay[] }>()
  for (const { date, completed, weeklyGoal } of tasks) {
    const userId = weeklyGoal.objective.userId
    const entry = byUser.get(userId) ?? { today: [], before: [] }
    ;(date >= today ? entry.today : entry.before).push({ date, completed })
    byUser.set(userId, entry)
  }

  const messages = new Map(
    userIds.map((userId) => {
      const entry = byUser.get(userId)
      return [userId, entry ? buildReminder(entry.today, countDaysDone(entry.before)) : null]
    }),
  )

  const options = { vapidDetails: config, TTL: 4 * 60 * 60, topic: 'lembrete-diario' }
  for (const subscription of subscriptions) {
    const message = messages.get(subscription.userId)
    if (!message) {
      run.skipped += 1
      continue
    }
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(message),
        options,
      )
      run.sent += 1
    } catch (error) {
      if (isGone(error)) {
        // deleteMany: the row may already be gone (turned off meanwhile), and
        // that must not stop the reminders still to send.
        await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } })
        run.removed += 1
      } else {
        run.failed += 1
      }
    }
  }

  return run
}
