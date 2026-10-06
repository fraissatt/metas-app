'use server'

import { prisma } from '@/lib/db'
import { addAppWeeks, getWeekBounds } from '@/lib/dates'
import { requireUser } from '@/lib/session'
import { buildWeekWindow, type LifetimeStats } from '@/lib/stats'

const WINDOW_WEEKS = 8

export async function getLifetimeStats(): Promise<LifetimeStats> {
  const user = await requireUser()
  const owned = { weeklyGoal: { objective: { userId: user.id } } }
  const now = new Date()
  const windowStart = addAppWeeks(getWeekBounds(now).weekStart, -(WINDOW_WEEKS - 1))

  const [totalCompleted, first, recent] = await Promise.all([
    prisma.dailyTask.count({ where: { completed: true, ...owned } }),
    prisma.dailyTask.findFirst({
      where: { completed: true, completedAt: { not: null }, ...owned },
      orderBy: { completedAt: 'asc' },
      select: { completedAt: true },
    }),
    prisma.dailyTask.findMany({
      where: { completed: true, completedAt: { gte: windowStart }, ...owned },
      select: { completedAt: true },
    }),
  ])

  // `completedAt: { gte: … }` already excludes nulls in SQL, but Prisma still
  // types the column as `Date | null`, so narrow it for `buildWeekWindow`.
  const completedAts = recent
    .map((task) => task.completedAt)
    .filter((completedAt): completedAt is Date => completedAt !== null)

  return {
    totalCompleted,
    firstCompletedAt: first?.completedAt ?? null,
    weekWindow: buildWeekWindow(completedAts, now, WINDOW_WEEKS),
  }
}
