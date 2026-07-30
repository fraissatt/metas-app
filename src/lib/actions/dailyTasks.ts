'use server'

import { parseISO, startOfDay, endOfDay } from 'date-fns'
import { prisma } from '@/lib/db'
import type { DailyTask, Objective, WeeklyGoal } from '@prisma/client'

export async function createDailyTask(weeklyGoalId: string, formData: FormData): Promise<void> {
  const title = String(formData.get('title') ?? '').trim()
  const date = String(formData.get('date') ?? '')

  await prisma.dailyTask.create({ data: { title, date: parseISO(date), weeklyGoalId } })
}

export async function listDailyTasksByWeeklyGoal(weeklyGoalId: string): Promise<DailyTask[]> {
  return prisma.dailyTask.findMany({ where: { weeklyGoalId }, orderBy: { date: 'asc' } })
}

export async function getDailyTask(id: string): Promise<DailyTask | null> {
  return prisma.dailyTask.findUnique({ where: { id } })
}

export async function updateDailyTask(id: string, formData: FormData): Promise<void> {
  const title = String(formData.get('title') ?? '').trim()
  const date = String(formData.get('date') ?? '')

  await prisma.dailyTask.update({ where: { id }, data: { title, date: parseISO(date) } })
}

export async function listDailyTasksByDate(
  date: Date,
): Promise<Array<DailyTask & { weeklyGoal: WeeklyGoal & { objective: Objective } }>> {
  const start = startOfDay(date)
  const end = endOfDay(date)

  return prisma.dailyTask.findMany({
    where: { date: { gte: start, lte: end } },
    include: { weeklyGoal: { include: { objective: true } } },
    orderBy: { date: 'asc' },
  })
}

export async function toggleDailyTask(id: string): Promise<void> {
  const task = await prisma.dailyTask.findUniqueOrThrow({ where: { id } })
  await prisma.dailyTask.update({
    where: { id },
    data: { completed: !task.completed, completedAt: task.completed ? null : new Date() },
  })
}

export async function deleteDailyTask(id: string): Promise<void> {
  await prisma.dailyTask.delete({ where: { id } })
}
