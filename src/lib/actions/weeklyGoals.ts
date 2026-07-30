'use server'

import { parseISO } from 'date-fns'
import { prisma } from '@/lib/db'
import { getWeekBounds } from '@/lib/dates'
import type { WeeklyGoal } from '@prisma/client'

function readWeeklyGoalFields(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  const weekOf = String(formData.get('weekOf') ?? '')
  const { weekStart, weekEnd } = getWeekBounds(parseISO(weekOf))

  return { title, weekStart, weekEnd }
}

export async function createWeeklyGoal(objectiveId: string, formData: FormData): Promise<void> {
  const fields = readWeeklyGoalFields(formData)
  await prisma.weeklyGoal.create({ data: { ...fields, objectiveId } })
}

export async function listWeeklyGoalsByObjective(objectiveId: string): Promise<WeeklyGoal[]> {
  return prisma.weeklyGoal.findMany({ where: { objectiveId }, orderBy: { weekStart: 'asc' } })
}

export async function getWeeklyGoal(id: string): Promise<WeeklyGoal | null> {
  return prisma.weeklyGoal.findUnique({ where: { id } })
}

export async function updateWeeklyGoal(id: string, formData: FormData): Promise<void> {
  await prisma.weeklyGoal.update({ where: { id }, data: readWeeklyGoalFields(formData) })
}

export async function deleteWeeklyGoal(id: string): Promise<void> {
  await prisma.weeklyGoal.delete({ where: { id } })
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
