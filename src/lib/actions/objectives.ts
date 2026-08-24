'use server'

import { differenceInCalendarWeeks } from 'date-fns'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { readDate, readOptionalDate, readTitle } from '@/lib/actions/validation'
import { buildObjectiveWeeks, type ObjectiveStats } from '@/lib/objectives'
import type { Objective } from '@prisma/client'

function readObjectiveFields(formData: FormData) {
  const title = readTitle(formData)
  const description = formData.get('description')

  return {
    title,
    description: description ? String(description) : null,
    startDate: readDate(formData, 'startDate'),
    targetDate: readOptionalDate(formData, 'targetDate'),
  }
}

export async function createObjective(formData: FormData): Promise<void> {
  await prisma.objective.create({ data: readObjectiveFields(formData) })
  revalidatePath('/objectives')
}

export async function listObjectives(): Promise<Objective[]> {
  return prisma.objective.findMany({ orderBy: { createdAt: 'desc' } })
}

export async function getObjective(id: string): Promise<Objective | null> {
  return prisma.objective.findUnique({ where: { id } })
}

export async function updateObjective(id: string, formData: FormData): Promise<void> {
  await prisma.objective.update({ where: { id }, data: readObjectiveFields(formData) })
  revalidatePath('/objectives')
}

export async function deleteObjective(id: string): Promise<void> {
  await prisma.objective.delete({ where: { id } })
  revalidatePath('/objectives')
}

const RECENT_WEEKS = 26

export async function getObjectiveStats(objectiveId: string): Promise<ObjectiveStats> {
  const objective = await prisma.objective.findUniqueOrThrow({
    where: { id: objectiveId },
    select: { startDate: true },
  })
  const goals = await prisma.weeklyGoal.findMany({
    where: { objectiveId },
    orderBy: { weekStart: 'asc' },
    include: { dailyTasks: { select: { completed: true } } },
  })

  const weeks = buildObjectiveWeeks(goals)

  return {
    weeksFulfilled: weeks.filter((week) => week.fulfilled).length,
    tasksCompleted: weeks.reduce((sum, week) => sum + week.completed, 0),
    // Calendar weeks crossed, not 7-day blocks, so this agrees with
    // `getWeekBounds` about where a week begins.
    weeksSinceStart: Math.max(
      0,
      differenceInCalendarWeeks(new Date(), objective.startDate, { weekStartsOn: 1 }),
    ),
    // The strip spans only the weeks this objective actually has. A four-week-old
    // objective shows four segments, not 26 with 22 blank — which would read as
    // failure to someone who has done nothing wrong.
    recentWeeks: weeks.slice(-RECENT_WEEKS),
  }
}
