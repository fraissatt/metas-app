'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { addAppDays, differenceInAppDays, formatDayKey, getWeekBounds, parseDay } from '@/lib/dates'
import { findOwnedObjective, findOwnedWeeklyGoal } from '@/lib/owned'
import { requireUser } from '@/lib/session'
import { readCheckbox, readDate, readTitle } from '@/lib/actions/validation'
import type { DailyTask, Prisma, Status, WeeklyGoal } from '@prisma/client'

export type WeeklyGoalWithTasks = WeeklyGoal & { dailyTasks: DailyTask[] }

function readWeeklyGoalFields(formData: FormData) {
  const title = readTitle(formData)
  const { weekStart, weekEnd } = getWeekBounds(readDate(formData, 'weekOf'))
  const recurring = readCheckbox(formData, 'recurring')

  return { title, weekStart, weekEnd, recurring }
}

export async function createWeeklyGoal(objectiveId: string, formData: FormData): Promise<void> {
  const user = await requireUser()
  await findOwnedObjective(user.id, objectiveId)
  const fields = readWeeklyGoalFields(formData)
  await prisma.weeklyGoal.create({ data: { ...fields, objectiveId } })
  revalidatePath(`/objectives/${objectiveId}`)
}

export async function listWeeklyGoalsByObjective(objectiveId: string): Promise<WeeklyGoalWithTasks[]> {
  const user = await requireUser()
  return prisma.weeklyGoal.findMany({
    where: { objectiveId, objective: { userId: user.id } },
    orderBy: { weekStart: 'asc' },
    include: { dailyTasks: { orderBy: { date: 'asc' } } },
  })
}

export type PastWeekSummary = { weekStart: string; total: number; completed: number }

/**
 * The objective page's weeks, split by weight: the current and any future
 * weeks come in full (that is where the user works), earlier weeks only as
 * one summary per week. Their tasks load on demand via
 * `listWeeklyGoalsForWeek`, so a long objective doesn't pull its whole
 * history on every visit.
 */
export async function listObjectiveWeeks(
  objectiveId: string,
): Promise<{ current: WeeklyGoalWithTasks[]; past: PastWeekSummary[] }> {
  const user = await requireUser()
  const owned = { objectiveId, objective: { userId: user.id } }
  const { weekStart: currentWeekStart } = getWeekBounds(new Date())

  const [current, pastGoals] = await Promise.all([
    prisma.weeklyGoal.findMany({
      where: { ...owned, weekStart: { gte: currentWeekStart } },
      orderBy: [{ weekStart: 'asc' }, { title: 'asc' }],
      include: { dailyTasks: { orderBy: { date: 'asc' } } },
    }),
    prisma.weeklyGoal.findMany({
      where: { ...owned, weekStart: { lt: currentWeekStart } },
      orderBy: { weekStart: 'desc' },
      select: { weekStart: true, dailyTasks: { select: { completed: true } } },
    }),
  ])

  // Several goals can share a week; the row shows the week as a whole.
  const byWeek = new Map<string, PastWeekSummary>()
  for (const goal of pastGoals) {
    const key = formatDayKey(goal.weekStart)
    const week = byWeek.get(key) ?? { weekStart: key, total: 0, completed: 0 }
    week.total += goal.dailyTasks.length
    week.completed += goal.dailyTasks.filter((task) => task.completed).length
    byWeek.set(key, week)
  }

  return { current, past: [...byWeek.values()] }
}

/** One earlier week's goals with their tasks, for a row the user opened. */
export async function listWeeklyGoalsForWeek(
  objectiveId: string,
  weekStart: string,
): Promise<WeeklyGoalWithTasks[]> {
  const user = await requireUser()
  let day: Date
  try {
    day = parseDay(String(weekStart))
  } catch {
    return []
  }
  const bounds = getWeekBounds(day)

  return prisma.weeklyGoal.findMany({
    where: { objectiveId, objective: { userId: user.id }, weekStart: bounds.weekStart },
    orderBy: { title: 'asc' },
    include: { dailyTasks: { orderBy: { date: 'asc' } } },
  })
}

export async function getWeeklyGoal(id: string): Promise<WeeklyGoal | null> {
  const user = await requireUser()
  return prisma.weeklyGoal.findFirst({ where: { id, objective: { userId: user.id } } })
}

export async function updateWeeklyGoal(id: string, formData: FormData): Promise<void> {
  const user = await requireUser()
  await findOwnedWeeklyGoal(user.id, id)
  const goal = await prisma.weeklyGoal.update({ where: { id }, data: readWeeklyGoalFields(formData) })
  revalidatePath(`/objectives/${goal.objectiveId}`)
}

export async function deleteWeeklyGoal(id: string): Promise<void> {
  const user = await requireUser()
  await findOwnedWeeklyGoal(user.id, id)
  const goal = await prisma.weeklyGoal.delete({ where: { id } })
  revalidatePath(`/objectives/${goal.objectiveId}`)
}

export async function getWeekProgress(
  weeklyGoalId: string,
): Promise<{ total: number; completed: number; percent: number }> {
  const user = await requireUser()
  await findOwnedWeeklyGoal(user.id, weeklyGoalId)
  const tasks = await prisma.dailyTask.findMany({ where: { weeklyGoalId } })
  const total = tasks.length
  const completed = tasks.filter((t) => t.completed).length
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  return { total, completed, percent }
}

export async function listWeeklyGoalsForCurrentWeek() {
  const user = await requireUser()
  const { weekStart, weekEnd } = getWeekBounds(new Date())
  return prisma.weeklyGoal.findMany({
    where: { weekStart: { equals: weekStart }, weekEnd: { equals: weekEnd }, objective: { userId: user.id } },
    include: { objective: true, dailyTasks: true },
  })
}

export type MissingGoalsPreview = {
  sourceWeekStart: Date
  goals: Array<{ id: string; title: string; taskCount: number }>
}

type SourceGoal = WeeklyGoal & { dailyTasks: DailyTask[]; objective: { status: Status } }

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
 * Only the given user's goals are considered — both when picking the source
 * week and when checking what already exists — so one account's planning never
 * leaks into another's recurrences.
 *
 * `db` defaults to the shared client; the write actions pass their transaction client so
 * the write recomputes this set atomically instead of trusting a stale render.
 *
 * Not exported: this module is `'use server'`, where every export becomes a
 * callable server action.
 */
async function findMissingGoals(
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

/** Goals the user plans week by week — offered manually, never materialised. */
function oneOffGoals(goals: SourceGoal[]): SourceGoal[] {
  return goals.filter((goal) => !goal.recurring)
}

/**
 * Goals that should reappear on their own. A completed objective stops
 * generating: its weeks are finished, and quietly recreating them would undo
 * the user's decision that it was done.
 */
function pendingRecurrences(goals: SourceGoal[]): SourceGoal[] {
  return goals.filter((goal) => goal.recurring && goal.objective.status !== 'COMPLETED')
}

/**
 * Clones goals from the source week into the current one, preserving each
 * task's weekday position.
 *
 * `recurring` is copied from the source, which is right for both callers:
 * `repeatMissingGoals` only ever passes one-off goals, and
 * `materializePendingWeek` only ever passes recurring ones — and a clone that
 * lost the flag would stop the chain after a single week.
 */
async function cloneGoalsInto(
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

export async function getMissingGoalsPreview(): Promise<MissingGoalsPreview | null> {
  const user = await requireUser()
  const { weekStart: currentWeekStart } = getWeekBounds(new Date())
  const missing = await findMissingGoals(currentWeekStart, user.id)
  if (!missing) return null

  const goals = oneOffGoals(missing.goals)
  if (goals.length === 0) return null

  return {
    sourceWeekStart: missing.sourceWeekStart,
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      taskCount: goal.dailyTasks.length,
    })),
  }
}

export async function repeatMissingGoals(): Promise<void> {
  const user = await requireUser()
  const { weekStart: currentWeekStart, weekEnd: currentWeekEnd } = getWeekBounds(new Date())
  let touchedObjectiveIds: string[] = []

  await prisma.$transaction(async (tx) => {
    // Recomputed inside the transaction rather than reusing what the page
    // rendered: two rapid clicks would otherwise both act on a stale set and
    // create the same goals twice. The second call finds nothing missing.
    const missing = await findMissingGoals(currentWeekStart, user.id, tx)
    if (!missing) return

    const goals = oneOffGoals(missing.goals)
    if (goals.length === 0) return

    touchedObjectiveIds = [...new Set(goals.map((goal) => goal.objectiveId))]

    await cloneGoalsInto(tx, goals, missing.sourceWeekStart, currentWeekStart, currentWeekEnd)
  })

  // Outside the transaction: cache invalidation is not part of the write, and
  // must not run at all if the write rolled back.
  revalidatePath('/')
  for (const objectiveId of touchedObjectiveIds) {
    revalidatePath(`/objectives/${objectiveId}`)
  }
}

export async function countPendingRecurrences(): Promise<number> {
  const user = await requireUser()
  const { weekStart: currentWeekStart } = getWeekBounds(new Date())
  const missing = await findMissingGoals(currentWeekStart, user.id)

  return missing ? pendingRecurrences(missing.goals).length : 0
}

export async function materializePendingWeek(): Promise<void> {
  const user = await requireUser()
  const { weekStart: currentWeekStart, weekEnd: currentWeekEnd } = getWeekBounds(new Date())
  let touchedObjectiveIds: string[] = []

  await prisma.$transaction(async (tx) => {
    // Recomputed inside the transaction, not reused from whatever the page
    // rendered: this is what makes remounts, retries, and genuinely concurrent
    // calls safe. The ref guard in WeekMaterializer already handles React
    // Strict Mode's double-invocation on its own.
    const missing = await findMissingGoals(currentWeekStart, user.id, tx)
    if (!missing) return

    const goals = pendingRecurrences(missing.goals)
    if (goals.length === 0) return

    touchedObjectiveIds = [...new Set(goals.map((goal) => goal.objectiveId))]
    await cloneGoalsInto(tx, goals, missing.sourceWeekStart, currentWeekStart, currentWeekEnd)
  })

  revalidatePath('/')
  for (const objectiveId of touchedObjectiveIds) {
    revalidatePath(`/objectives/${objectiveId}`)
  }
}
