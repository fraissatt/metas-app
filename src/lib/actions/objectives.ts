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

// A count rather than `(await listObjectives()).length`: the home page only
// needs to know whether any objective exists, and should not pull every row to
// find out.
export async function countObjectives(): Promise<number> {
  return prisma.objective.count()
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
    select: { startDate: true, completedAt: true },
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
    // `getWeekBounds` about where a week begins. Frozen at `completedAt` for a
    // completed objective so the count stops growing once the objective is done.
    weeksSinceStart: Math.max(
      0,
      differenceInCalendarWeeks(objective.completedAt ?? new Date(), objective.startDate, {
        weekStartsOn: 1,
      }),
    ),
    // The strip spans only the weeks this objective actually has. A four-week-old
    // objective shows four segments, not 26 with 22 blank — which would read as
    // failure to someone who has done nothing wrong.
    recentWeeks: weeks.slice(-RECENT_WEEKS),
  }
}

// `status` and `completedAt` are always written together — COMPLETED with a
// timestamp, ACTIVE with null — so the two can never disagree.
export async function completeObjective(id: string): Promise<void> {
  await prisma.objective.update({
    where: { id },
    data: { status: 'COMPLETED', completedAt: new Date() },
  })
  revalidatePath('/objectives')
  revalidatePath(`/objectives/${id}`)
}

export async function reopenObjective(id: string): Promise<void> {
  await prisma.objective.update({
    where: { id },
    data: { status: 'ACTIVE', completedAt: null },
  })
  revalidatePath('/objectives')
  revalidatePath(`/objectives/${id}`)
}

export type ObjectiveWithStats = Objective & { stats: ObjectiveStats }

export async function listObjectivesWithStats(): Promise<{
  active: ObjectiveWithStats[]
  completed: ObjectiveWithStats[]
}> {
  const objectives = await prisma.objective.findMany({ orderBy: { createdAt: 'desc' } })

  // One stats query per objective, in parallel. This is N+1 by construction and
  // deliberately so: it keeps the week-fulfilment rule in `buildObjectiveWeeks`
  // instead of duplicating it into SQL, and follows the precedent already set by
  // `getObjectiveProgressSeries`. Revisit if objective counts reach the hundreds.
  const withStats = await Promise.all(
    objectives.map(async (objective) => ({
      ...objective,
      stats: await getObjectiveStats(objective.id),
    })),
  )

  return {
    // ABANDONED never occurs today (no screen writes it) and would land in
    // `active` if it ever did, which is the safer of the two buckets.
    active: withStats.filter((objective) => objective.status !== 'COMPLETED'),
    completed: withStats
      .filter((objective) => objective.status === 'COMPLETED')
      .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)),
  }
}
