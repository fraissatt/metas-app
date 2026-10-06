import { prisma } from '@/lib/db'

// lastSeenAt is bumped at most once an hour, so the effective idle window is 23-24 h.
export const GUEST_IDLE_MS = 24 * 3600_000
export const MAX_GUESTS = 200

// Runs right before a guest is created, so it keeps MAX_GUESTS - 1 and the
// new one brings the total to the cap. Objectives, goals, tasks, sessions
// and accounts go with each user through the schema's cascades.
export async function cleanupGuests(now: Date = new Date()): Promise<number> {
  const idle = await prisma.user.deleteMany({
    where: { isAnonymous: true, lastSeenAt: { lt: new Date(now.getTime() - GUEST_IDLE_MS) } },
  })

  const overflow = await prisma.user.findMany({
    where: { isAnonymous: true },
    orderBy: [{ lastSeenAt: 'desc' }, { id: 'asc' }],
    skip: MAX_GUESTS - 1,
    select: { id: true },
  })
  const capped = overflow.length
    ? await prisma.user.deleteMany({ where: { id: { in: overflow.map((u) => u.id) } } })
    : { count: 0 }

  return idle.count + capped.count
}
