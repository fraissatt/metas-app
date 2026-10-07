'use server'

import { prisma } from '@/lib/db'
import { endOfAppDay, getWeekBounds, startOfAppDay } from '@/lib/dates'
import { requireUser } from '@/lib/session'

export type TodaySummary = { completed: number; total: number; weekStart: Date }

// Two counts rather than loading the tasks: the header renders on every page
// and only needs the numbers. Same day bounds as listDailyTasksByDate.
export async function getTodaySummary(now: Date = new Date()): Promise<TodaySummary> {
  const user = await requireUser()
  const owned = { weeklyGoal: { objective: { userId: user.id } } }
  const date = { gte: startOfAppDay(now), lte: endOfAppDay(now) }
  const [total, completed] = await Promise.all([
    prisma.dailyTask.count({ where: { date, ...owned } }),
    prisma.dailyTask.count({ where: { date, completed: true, ...owned } }),
  ])
  return { completed, total, weekStart: getWeekBounds(now).weekStart }
}
