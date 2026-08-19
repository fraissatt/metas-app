'use server'

import { addWeeks } from 'date-fns'
import { prisma } from '@/lib/db'
import { getWeekBounds } from '@/lib/dates'
import { buildWeekWindow, type LifetimeStats } from '@/lib/stats'

const WINDOW_WEEKS = 8

export async function getLifetimeStats(): Promise<LifetimeStats> {
  const now = new Date()
  const windowStart = addWeeks(getWeekBounds(now).weekStart, -(WINDOW_WEEKS - 1))

  const [totalCompleted, first, recent] = await Promise.all([
    prisma.dailyTask.count({ where: { completed: true } }),
    prisma.dailyTask.findFirst({
      where: { completed: true, completedAt: { not: null } },
      orderBy: { completedAt: 'asc' },
      select: { completedAt: true },
    }),
    prisma.dailyTask.findMany({
      where: { completed: true, completedAt: { gte: windowStart } },
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
