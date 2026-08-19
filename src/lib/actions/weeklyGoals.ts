'use server'

import { revalidatePath } from 'next/cache'
import { addDays, differenceInCalendarDays } from 'date-fns'
import { prisma } from '@/lib/db'
import { getWeekBounds } from '@/lib/dates'
import { readDate, readTitle } from '@/lib/actions/validation'
import type { DailyTask, Prisma, WeeklyGoal } from '@prisma/client'

export type WeeklyGoalWithTasks = WeeklyGoal & { dailyTasks: DailyTask[] }

function readWeeklyGoalFields(formData: FormData) {
  const title = readTitle(formData)
  const { weekStart, weekEnd } = getWeekBounds(readDate(formData, 'weekOf'))

  return { title, weekStart, weekEnd }
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

export type MissingGoalsPreview = {
  sourceWeekStart: Date
  goals: Array<{ id: string; title: string; taskCount: number }>
}

type SourceGoal = WeeklyGoal & { dailyTasks: DailyTask[] }

// A goal's identity across weeks is the objective it belongs to plus its
// title. A space is an unambiguous separator here because `objectiveId` is a
// cuid — alphanumeric, never containing one — so the first space in the key
// always marks the boundary, whatever the user typed as a title.
function goalKey(goal: { objectiveId: string; title: string }): string {
  return `${goal.objectiveId} ${goal.title}`
}

/**
 * The goals from the last planned week that have no counterpart in the current
 * one. The source week is the most recent week that actually had goals — not
 * simply the previous calendar week, since someone away for three weeks would
 * find that one empty, and that is exactly the user this serves.
 *
 * `db` defaults to the shared client; Task 3 passes its transaction client so
 * the write recomputes this set atomically instead of trusting a stale render.
 *
 * Not exported: this module is `'use server'`, where every export becomes a
 * callable server action.
 */
async function findMissingGoals(
  currentWeekStart: Date,
  db: Prisma.TransactionClient = prisma,
): Promise<{ sourceWeekStart: Date; goals: SourceGoal[] } | null> {
  const previous = await db.weeklyGoal.findFirst({
    where: { weekStart: { lt: currentWeekStart } },
    orderBy: { weekStart: 'desc' },
    select: { weekStart: true },
  })
  if (!previous) return null

  const [sourceGoals, currentGoals] = await Promise.all([
    db.weeklyGoal.findMany({
      where: { weekStart: previous.weekStart },
      orderBy: { title: 'asc' },
      include: { dailyTasks: true },
    }),
    db.weeklyGoal.findMany({
      where: { weekStart: currentWeekStart },
      select: { objectiveId: true, title: true },
    }),
  ])

  const alreadyHere = new Set(currentGoals.map(goalKey))

  return {
    sourceWeekStart: previous.weekStart,
    goals: sourceGoals.filter((goal) => !alreadyHere.has(goalKey(goal))),
  }
}

export async function getMissingGoalsPreview(): Promise<MissingGoalsPreview | null> {
  const { weekStart: currentWeekStart } = getWeekBounds(new Date())
  const missing = await findMissingGoals(currentWeekStart)
  if (!missing || missing.goals.length === 0) return null

  return {
    sourceWeekStart: missing.sourceWeekStart,
    goals: missing.goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      taskCount: goal.dailyTasks.length,
    })),
  }
}

export async function repeatMissingGoals(): Promise<void> {
  const { weekStart: currentWeekStart, weekEnd: currentWeekEnd } = getWeekBounds(new Date())
  let touchedObjectiveIds: string[] = []

  await prisma.$transaction(async (tx) => {
    // Recomputed inside the transaction rather than reusing what the page
    // rendered: two rapid clicks would otherwise both act on a stale set and
    // create the same goals twice. The second call finds nothing missing.
    const missing = await findMissingGoals(currentWeekStart, tx)
    if (!missing || missing.goals.length === 0) return

    touchedObjectiveIds = [...new Set(missing.goals.map((goal) => goal.objectiveId))]

    for (const goal of missing.goals) {
      // `completed` and `completedAt` are left to their schema defaults
      // (false / null) — a week brought forward starts unfinished.
      const clone = await tx.weeklyGoal.create({
        data: {
          title: goal.title,
          objectiveId: goal.objectiveId,
          weekStart: currentWeekStart,
          weekEnd: currentWeekEnd,
        },
      })

      if (goal.dailyTasks.length === 0) continue

      await tx.dailyTask.createMany({
        data: goal.dailyTasks.map((task) => ({
          title: task.title,
          weeklyGoalId: clone.id,
          // Offset in calendar days, not elapsed milliseconds: a DST change
          // inside the source week would otherwise shift a task onto the
          // wrong weekday.
          date: addDays(currentWeekStart, differenceInCalendarDays(task.date, missing.sourceWeekStart)),
        })),
      })
    }
  })

  // Outside the transaction: cache invalidation is not part of the write, and
  // must not run at all if the write rolled back.
  revalidatePath('/')
  for (const objectiveId of touchedObjectiveIds) {
    revalidatePath(`/objectives/${objectiveId}`)
  }
}
