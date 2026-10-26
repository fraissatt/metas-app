import { prisma } from '@/lib/db'
import { addAppDays, differenceInAppDays } from '@/lib/dates'
import type { DailyTask, Prisma, Status, WeeklyGoal } from '@prisma/client'

// Copying goals from one week into another, shared by the "Ficou para trás"
// repeat, the recurring goals and the weekly review. A plain module, not
// 'use server': none of this may be callable from the browser.

export type SourceGoal = WeeklyGoal & { dailyTasks: DailyTask[]; objective: { status: Status } }

// A goal's identity across weeks is the objective it belongs to plus its
// title. A space is an unambiguous separator here because `objectiveId` is a
// cuid — alphanumeric, never containing one — so the first space in the key
// always marks the boundary, whatever the user typed as a title.
export function goalKey(goal: { objectiveId: string; title: string }): string {
  return `${goal.objectiveId} ${goal.title}`
}

/**
 * The goals from the last planned week that have no counterpart in the current
 * one. The source week is the most recent week that actually had goals — not
 * simply the previous calendar week, since someone away for three weeks would
 * find that one empty, and that is exactly the user this serves.
 *
 * Only the given user's goals are considered — both when picking the source
 * week and when checking what already exists — so one account's planning never
 * leaks into another's recurrences.
 *
 * `db` defaults to the shared client; the write actions pass their transaction client so
 * the write recomputes this set atomically instead of trusting a stale render.
 */
export async function findMissingGoals(
  currentWeekStart: Date,
  userId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<{ sourceWeekStart: Date; goals: SourceGoal[] } | null> {
  const previous = await db.weeklyGoal.findFirst({
    where: { weekStart: { lt: currentWeekStart }, objective: { userId } },
    orderBy: { weekStart: 'desc' },
    select: { weekStart: true },
  })
  if (!previous) return null

  const [sourceGoals, currentGoals] = await Promise.all([
    db.weeklyGoal.findMany({
      where: { weekStart: previous.weekStart, objective: { userId } },
      orderBy: { title: 'asc' },
      include: { dailyTasks: true, objective: { select: { status: true } } },
    }),
    db.weeklyGoal.findMany({
      where: { weekStart: currentWeekStart, objective: { userId } },
      select: { objectiveId: true, title: true },
    }),
  ])

  const alreadyHere = new Set(currentGoals.map(goalKey))

  return {
    sourceWeekStart: previous.weekStart,
    goals: sourceGoals.filter((goal) => !alreadyHere.has(goalKey(goal))),
  }
}

/**
 * Clones goals from the source week into the current one, preserving each
 * task's weekday position.
 *
 * `recurring` is copied from the source, which is right for both callers:
 * `repeatMissingGoals` and `finishWeekReview` only ever pass one-off goals, and
 * `materializePendingWeek` only ever passes recurring ones — and a clone that
 * lost the flag would stop the chain after a single week.
 */
export async function cloneGoalsInto(
  tx: Prisma.TransactionClient,
  goals: SourceGoal[],
  sourceWeekStart: Date,
  currentWeekStart: Date,
  currentWeekEnd: Date,
): Promise<void> {
  for (const goal of goals) {
    // `completed` and `completedAt` are left to their schema defaults
    // (false / null) — a week that has just arrived starts unfinished.
    const clone = await tx.weeklyGoal.create({
      data: {
        title: goal.title,
        objectiveId: goal.objectiveId,
        weekStart: currentWeekStart,
        weekEnd: currentWeekEnd,
        recurring: goal.recurring,
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
        date: addAppDays(currentWeekStart, differenceInAppDays(task.date, sourceWeekStart)),
      })),
    })
  }
}
