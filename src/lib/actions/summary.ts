'use server'

import { endOfDay, startOfDay } from 'date-fns'
import { prisma } from '@/lib/db'
import { getWeekBounds } from '@/lib/dates'

export type TodaySummary = { completed: number; total: number; weekStart: Date }

// Two counts rather than loading the tasks: the header renders on every page
// and only needs the numbers. Same day bounds as listDailyTasksByDate.
export async function getTodaySummary(now: Date = new Date()): Promise<TodaySummary> {
  const date = { gte: startOfDay(now), lte: endOfDay(now) }
  const [total, completed] = await Promise.all([
    prisma.dailyTask.count({ where: { date } }),
    prisma.dailyTask.count({ where: { date, completed: true } }),
  ])
  return { completed, total, weekStart: getWeekBounds(now).weekStart }
}
