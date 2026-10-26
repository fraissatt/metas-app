'use server'

import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/session'

/** What `PushSubscription.toJSON()` gives in the browser. */
export type BrowserSubscription = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }

const MAX_FIELD = 2048

function readField(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_FIELD) {
    throw new TypeError('Inscrição inválida.')
  }
  return value
}

/**
 * Turns the daily reminder on for this browser. The endpoint identifies the
 * device, so signing in to another account on it moves the row there instead
 * of sending one person's reminders to another.
 */
export async function saveReminderSubscription(subscription: BrowserSubscription): Promise<void> {
  const user = await requireUser()
  const endpoint = readField(subscription?.endpoint)
  if (!endpoint.startsWith('https://')) throw new TypeError('Inscrição inválida.')
  const keys = { p256dh: readField(subscription?.keys?.p256dh), auth: readField(subscription?.keys?.auth) }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, ...keys },
    update: { userId: user.id, ...keys },
  })
}

/** Turns the daily reminder off for this browser. Only ever touches the user's own row. */
export async function removeReminderSubscription(endpoint: string): Promise<void> {
  const user = await requireUser()
  await prisma.pushSubscription.deleteMany({ where: { endpoint: String(endpoint), userId: user.id } })
}
