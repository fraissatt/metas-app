'use server'

import { endOfDay, parseISO, startOfDay } from 'date-fns'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { readDate, readTitle } from '@/lib/actions/validation'
import type { DailyTask, Objective, WeeklyGoal } from '@prisma/client'

async function revalidateWeekPath(weeklyGoalId: string): Promise<void> {
  const goal = await prisma.weeklyGoal.findUnique({
    where: { id: weeklyGoalId },
    select: { objectiveId: true },
  })
  if (goal) {
    revalidatePath(`/objectives/${goal.objectiveId}/weeks/${weeklyGoalId}`)
    // The objective detail page now also renders live weekly-goal/task data
    // inline (quick-add, progress, expanded per-day view), so it needs the
    // same revalidation as the weekly goal's own page.
    revalidatePath(`/objectives/${goal.objectiveId}`)
  }
}

export async function createDailyTask(weeklyGoalId: string, formData: FormData): Promise<void> {
  const title = readTitle(formData)
  const date = readDate(formData, 'date')

  await prisma.dailyTask.create({ data: { title, date, weeklyGoalId } })
  await revalidateWeekPath(weeklyGoalId)
  // The Today view on `/` also renders daily tasks by date, so a task
  // created for today needs to appear there too.
  revalidatePath('/')
}

export async function createDailyTasks(weeklyGoalId: string, formData: FormData): Promise<void> {
  const title = readTitle(formData)
  const rawDates = formData.getAll('dates').map(String)
  if (rawDates.length === 0) {
    throw new Error('Selecione ao menos um dia')
  }

  const dates = rawDates.map((raw) => {
    const date = parseISO(raw)
    if (Number.isNaN(date.getTime())) {
      throw new Error('"dates" must contain valid dates')
    }
    return date
  })

  await prisma.dailyTask.createMany({
    data: dates.map((date) => ({ title, date, weeklyGoalId })),
  })
  await revalidateWeekPath(weeklyGoalId)
  revalidatePath('/')
}

export async function listDailyTasksByWeeklyGoal(weeklyGoalId: string): Promise<DailyTask[]> {
  return prisma.dailyTask.findMany({ where: { weeklyGoalId }, orderBy: { date: 'asc' } })
}

export async function getDailyTask(id: string): Promise<DailyTask | null> {
  return prisma.dailyTask.findUnique({ where: { id } })
}

export async function updateDailyTask(id: string, formData: FormData): Promise<void> {
  const title = readTitle(formData)
  const date = readDate(formData, 'date')

  const task = await prisma.dailyTask.update({ where: { id }, data: { title, date } })
  await revalidateWeekPath(task.weeklyGoalId)
  // The Today view on `/` also renders this task, so moving its date (or
  // renaming it) needs to be reflected there too.
  revalidatePath('/')
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
  await revalidateWeekPath(task.weeklyGoalId)
  // The Today view on `/` also renders this task's completion state, so it
  // needs its own revalidation on top of the weekly-goal detail page above.
  revalidatePath('/')
}

export async function deleteDailyTask(id: string): Promise<void> {
  const task = await prisma.dailyTask.delete({ where: { id } })
  await revalidateWeekPath(task.weeklyGoalId)
  // The Today view on `/` also renders this task, so deleting it needs to
  // remove it from there too.
  revalidatePath('/')
}
