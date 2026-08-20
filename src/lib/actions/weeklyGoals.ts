'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { getWeekBounds } from '@/lib/dates'
import { readCheckbox, readDate, readTitle } from '@/lib/actions/validation'
import type { DailyTask, WeeklyGoal } from '@prisma/client'

export type WeeklyGoalWithTasks = WeeklyGoal & { dailyTasks: DailyTask[] }

function readWeeklyGoalFields(formData: FormData) {
  const title = readTitle(formData)
  const { weekStart, weekEnd } = getWeekBounds(readDate(formData, 'weekOf'))
  const recurring = readCheckbox(formData, 'recurring')

  return { title, weekStart, weekEnd, recurring }
}

export async function createWeeklyGoal(objectiveId: string, formData: FormData): Promise<void> {
  const fields = readWeeklyGoalFields(formData)
  await prisma.weeklyGoal.create({ data: { ...fields, objectiveId } })
  revalidatePath(`/objectives/${objectiveId}`)
}

export async function listWeeklyGoalsByObjective(objectiveId: string): Promise<WeeklyGoalWithTasks[]> {
  return prisma.weeklyGoal.findMany({
    where: { objectiveId },
    orderBy: { weekStart: 'asc' },
    include: { dailyTasks: { orderBy: { date: 'asc' } } },
  })
}

export async function getWeeklyGoal(id: string): Promise<WeeklyGoal | null> {
  return prisma.weeklyGoal.findUnique({ where: { id } })
}

export async function updateWeeklyGoal(id: string, formData: FormData): Promise<void> {
  const goal = await prisma.weeklyGoal.update({ where: { id }, data: readWeeklyGoalFields(formData) })
  revalidatePath(`/objectives/${goal.objectiveId}`)
}

export async function deleteWeeklyGoal(id: string): Promise<void> {
  const goal = await prisma.weeklyGoal.delete({ where: { id } })
  revalidatePath(`/objectives/${goal.objectiveId}`)
}

export async function getWeekProgress(
  weeklyGoalId: string,
): Promise<{ total: number; completed: number; percent: number }> {
  const tasks = await prisma.dailyTask.findMany({ where: { weeklyGoalId } })
  const total = tasks.length
  const completed = tasks.filter((t) => t.completed).length
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  return { total, completed, percent }
}

export async function listWeeklyGoalsForCurrentWeek() {
  const { weekStart, weekEnd } = getWeekBounds(new Date())
  return prisma.weeklyGoal.findMany({
    where: { weekStart: { equals: weekStart }, weekEnd: { equals: weekEnd } },
    include: { objective: true, dailyTasks: true },
  })
}
