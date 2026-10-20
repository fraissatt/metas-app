'use server'

import { prisma } from '@/lib/db'
import { addAppDays, addAppWeeks, appYear, getWeekBounds, getYearDays } from '@/lib/dates'
import { buildDayDots, countDaysDone, type DayDotsYear } from '@/lib/day-dots'
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

/**
 * The dot calendar for one year (the current one by default), plus the
 * all-time days done and the first year there is anything to show.
 * Reads only, so it is safe to call while rendering a prefetched page.
 */
export async function getDayDots(year?: number): Promise<DayDotsYear> {
  const user = await requireUser()
  const owned = { weeklyGoal: { objective: { userId: user.id } } }
  const now = new Date()
  const currentYear = appYear(now)

  // Every task, only two columns: days done is all-time, and the earliest
  // date gives the first year. Small enough at this app's scale per user.
  const [tasks, account] = await Promise.all([
    prisma.dailyTask.findMany({ where: owned, select: { date: true, completed: true } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { createdAt: true } }),
  ])

  const firstYear = tasks.reduce(
    (first, task) => Math.min(first, appYear(task.date)),
    Math.min(currentYear, account ? appYear(account.createdAt) : currentYear),
  )
  const shown = Math.min(Math.max(year ?? currentYear, firstYear), currentYear)
  const days = getYearDays(shown)
  const yearStart = days[0]
  const nextYearStart = addAppDays(days[days.length - 1], 1)
  const yearTasks = tasks.filter((task) => task.date >= yearStart && task.date < nextYearStart)

  return {
    year: shown,
    dots: buildDayDots(yearTasks, days, now),
    daysDone: countDaysDone(tasks),
    firstYear,
    currentYear,
  }
}
