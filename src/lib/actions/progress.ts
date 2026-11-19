'use server'

import { formatDayMonth } from '@/lib/dates'
import { prisma } from '@/lib/db'
import { buildObjectiveWeeks } from '@/lib/objectives'
import { findOwnedObjective } from '@/lib/owned'
import { requireUser } from '@/lib/session'

export async function getObjectiveProgressSeries(
  objectiveId: string,
): Promise<Array<{ weekLabel: string; percent: number }>> {
  const user = await requireUser()
  await findOwnedObjective(user.id, objectiveId)
  const weeklyGoals = await prisma.weeklyGoal.findMany({
    where: { objectiveId },
    orderBy: { weekStart: 'asc' },
    include: { dailyTasks: { select: { completed: true } } },
  })

  // Aggregated per week rather than per goal: an objective with two goals in
  // one week used to emit two bars carrying the same `dd/MM` label. Doing it in
  // memory also drops the previous one-query-per-goal `getWeekProgress` loop.
  return buildObjectiveWeeks(weeklyGoals).map((week) => ({
    weekLabel: formatDayMonth(week.weekStart),
    percent: week.total === 0 ? 0 : Math.round((week.completed / week.total) * 100),
  }))
}

export type ObjectivePaceInput = {
  tasks: Array<{ date: string; completed: boolean; completedAt: string | null }>
  startDate: string
  targetDate: string | null
  completedAt: string | null
}

/**
 * Everything the pace chart needs about one objective. Dates travel as ISO
 * strings because the chart is a client component and `Date` does not survive
 * the server/client boundary as a `Date`.
 */
export async function getObjectivePaceInput(objectiveId: string): Promise<ObjectivePaceInput> {
  const user = await requireUser()
  const objective = await findOwnedObjective(user.id, objectiveId)
  const tasks = await prisma.dailyTask.findMany({
    where: { weeklyGoal: { objectiveId } },
    select: { date: true, completed: true, completedAt: true },
    orderBy: { date: 'asc' },
  })

  return {
    tasks: tasks.map((task) => ({
      date: task.date.toISOString(),
      completed: task.completed,
      completedAt: task.completedAt?.toISOString() ?? null,
    })),
    startDate: objective.startDate.toISOString(),
    targetDate: objective.targetDate?.toISOString() ?? null,
    completedAt: objective.completedAt?.toISOString() ?? null,
  }
}

export type OverallPaceInput = Array<ObjectivePaceInput & { id: string; title: string }>

/**
 * The pace inputs of every objective still in progress, in two queries (not one
 * per objective). Dates travel as ISO strings, as in `getObjectivePaceInput`.
 */
export async function getOverallPaceInput(): Promise<OverallPaceInput> {
  const user = await requireUser()
  const objectives = await prisma.objective.findMany({
    where: { userId: user.id, status: { not: 'COMPLETED' } },
    orderBy: { createdAt: 'asc' },
  })
  if (objectives.length === 0) return []

  const tasks = await prisma.dailyTask.findMany({
    where: { weeklyGoal: { objectiveId: { in: objectives.map((objective) => objective.id) } } },
    select: { date: true, completed: true, completedAt: true, weeklyGoal: { select: { objectiveId: true } } },
    orderBy: { date: 'asc' },
  })

  return objectives.map((objective) => ({
    id: objective.id,
    title: objective.title,
    tasks: tasks
      .filter((task) => task.weeklyGoal.objectiveId === objective.id)
      .map((task) => ({
        date: task.date.toISOString(),
        completed: task.completed,
        completedAt: task.completedAt?.toISOString() ?? null,
      })),
    startDate: objective.startDate.toISOString(),
    targetDate: objective.targetDate?.toISOString() ?? null,
    completedAt: null,
  }))
}
