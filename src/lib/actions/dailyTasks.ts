'use server'

import { parseISO } from 'date-fns'
import { prisma } from '@/lib/db'
import type { DailyTask } from '@prisma/client'

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

export async function listDailyTasksByDate(date: Date) {
  // Filter by local calendar date (e.g., for timezone-aware environments)
  // Extract the LOCAL date components from the input date
  const inputYear = date.getFullYear()
  const inputMonth = date.getMonth()
  const inputDay = date.getDate()

  const allTasks = await prisma.dailyTask.findMany({
    include: { weeklyGoal: { include: { objective: true } } },
  })

  return allTasks
    .filter((task) => {
      const taskYear = task.date.getFullYear()
      const taskMonth = task.date.getMonth()
      const taskDay = task.date.getDate()
      return taskYear === inputYear && taskMonth === inputMonth && taskDay === inputDay
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
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
