'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { addAppWeeks, formatDayKey, formatWeekRange, getWeekBounds, parseDay } from '@/lib/dates'
import { countDaysDone } from '@/lib/day-dots'
import { cloneGoalsInto, goalKey } from '@/lib/goal-copy'
import { requireUser } from '@/lib/session'
import {
  buildWeekReview,
  isInviteDue,
  pickReviewWeek,
  repeatTargetWeek,
  summarizeWeek,
  type ReviewWeek,
  type WeekSummary,
  type WeekReviewData,
} from '@/lib/week-review'

/** More than anyone plans in a week; bounds what a crafted request can ask for. */
const MAX_GOAL_IDS = 200

async function findReviewWeek(userId: string, now: Date): Promise<ReviewWeek | null> {
  const { weekStart: currentWeekStart } = getWeekBounds(now)
  const [currentCount, lastPlanned] = await Promise.all([
    prisma.weeklyGoal.count({ where: { weekStart: currentWeekStart, objective: { userId } } }),
    prisma.weeklyGoal.findFirst({
      where: { weekStart: { lt: currentWeekStart }, objective: { userId } },
      orderBy: { weekStart: 'desc' },
      select: { weekStart: true },
    }),
  ])

  return pickReviewWeek(now, {
    currentWeekHasGoals: currentCount > 0,
    lastPlannedWeekStart: lastPlanned?.weekStart ?? null,
  })
}

async function loadWeekReview(userId: string, week: ReviewWeek, now: Date): Promise<WeekReviewData> {
  const target = repeatTargetWeek(now)
  const taskDay = { select: { date: true, completed: true } } as const

  const [goals, plannedInTarget, review, previousWeekTasks, tasksBefore] = await Promise.all([
    prisma.weeklyGoal.findMany({
      where: { weekStart: week.weekStart, objective: { userId } },
      include: { dailyTasks: taskDay, objective: { select: { title: true, status: true } } },
    }),
    prisma.weeklyGoal.findMany({
      where: { weekStart: target.weekStart, objective: { userId } },
      select: { objectiveId: true, title: true },
    }),
    prisma.weekReview.findUnique({ where: { userId_weekStart: { userId, weekStart: week.weekStart } } }),
    prisma.dailyTask.findMany({
      where: { weeklyGoal: { weekStart: addAppWeeks(week.weekStart, -1), objective: { userId } } },
      ...taskDay,
    }),
    // Days done are counted by the day a task was planned for, like the
    // calendar, so "before the week" is by task date.
    prisma.dailyTask.findMany({
      where: { date: { lt: week.weekStart }, weeklyGoal: { objective: { userId } } },
      ...taskDay,
    }),
  ])

  const planned = new Set(plannedInTarget.map(goalKey))

  return buildWeekReview({
    week,
    now,
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      objectiveTitle: goal.objective.title,
      recurring: goal.recurring,
      objectiveCompleted: goal.objective.status === 'COMPLETED',
      alreadyPlanned: planned.has(goalKey(goal)),
      tasks: goal.dailyTasks,
    })),
    previousWeekTasks,
    daysDoneBefore: countDaysDone(tasksBefore),
    reviewedAt: review?.reviewedAt ?? null,
  })
}

/** The week to review on /revisao, or null when nothing was planned yet. Reads only. */
export async function getWeekReview(): Promise<WeekReviewData | null> {
  const user = await requireUser()
  const now = new Date()
  const week = await findReviewWeek(user.id, now)
  return week ? loadWeekReview(user.id, week, now) : null
}

export type WeekReviewInvite = WeekSummary & { weekKey: string; rangeLabel: string }

/** Hoje's invitation: only when the review is due and the week is not reviewed. Reads only. */
export async function getWeekReviewInvite(): Promise<WeekReviewInvite | null> {
  const user = await requireUser()
  const now = new Date()
  const week = await findReviewWeek(user.id, now)
  if (!week || !isInviteDue(now, week)) return null

  const reviewed = await prisma.weekReview.findUnique({
    where: { userId_weekStart: { userId: user.id, weekStart: week.weekStart } },
    select: { id: true },
  })
  if (reviewed) return null

  const tasks = await prisma.dailyTask.findMany({
    where: { weeklyGoal: { weekStart: week.weekStart, objective: { userId: user.id } } },
    select: { date: true, completed: true },
  })
  return {
    weekKey: formatDayKey(week.weekStart),
    rangeLabel: formatWeekRange(week.weekStart),
    ...summarizeWeek(week.weekStart, tasks, now),
  }
}

/**
 * Closes the week that is up for review: copies the ticked goals into the
 * target week (next week at the weekend, the current one otherwise) and
 * records the review.
 *
 * Only the week the page itself would show is accepted, so a stale page or a
 * crafted call cannot review some other week. Everything is re-read inside
 * the transaction, as `repeatMissingGoals` does: only the user's own one-off
 * goals of that week from active objectives are copied, and any already
 * planned in the target week are skipped.
 */
export async function finishWeekReview(weekKey: string, goalIds: string[]): Promise<void> {
  const user = await requireUser()
  const now = new Date()
  const { weekStart } = getWeekBounds(parseDay(String(weekKey)))
  const week = await findReviewWeek(user.id, now)
  if (!week || week.weekStart.getTime() !== weekStart.getTime()) {
    throw new RangeError('Esta semana não está mais em revisão. Recarregue a página.')
  }

  const ids = (Array.isArray(goalIds) ? goalIds : [])
    .filter((id): id is string => typeof id === 'string')
    .slice(0, MAX_GOAL_IDS)
  const target = repeatTargetWeek(now)
  let touchedObjectiveIds: string[] = []

  await prisma.$transaction(async (tx) => {
    // First, not last: the upsert (INSERT … ON CONFLICT) locks this user's
    // review row, so a second submit of the same week (another tab, a retry)
    // waits here until this one commits, and then reads the goals it copied
    // instead of copying them again.
    await tx.weekReview.upsert({
      where: { userId_weekStart: { userId: user.id, weekStart } },
      create: { userId: user.id, weekStart },
      update: { reviewedAt: now },
    })
    if (ids.length === 0) return

    const [chosen, planned] = await Promise.all([
      tx.weeklyGoal.findMany({
        where: {
          id: { in: ids },
          weekStart,
          recurring: false,
          objective: { userId: user.id, status: { not: 'COMPLETED' } },
        },
        orderBy: { title: 'asc' },
        include: { dailyTasks: true, objective: { select: { status: true } } },
      }),
      tx.weeklyGoal.findMany({
        where: { weekStart: target.weekStart, objective: { userId: user.id } },
        select: { objectiveId: true, title: true },
      }),
    ])

    const alreadyThere = new Set(planned.map(goalKey))
    const goals = chosen.filter((goal) => !alreadyThere.has(goalKey(goal)))
    touchedObjectiveIds = [...new Set(goals.map((goal) => goal.objectiveId))]
    await cloneGoalsInto(tx, goals, weekStart, target.weekStart, target.weekEnd)
  })

  revalidatePath('/')
  revalidatePath('/revisao')
  for (const objectiveId of touchedObjectiveIds) {
    revalidatePath(`/objectives/${objectiveId}`)
  }
}
