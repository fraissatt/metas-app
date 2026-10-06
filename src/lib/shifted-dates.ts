import type { PrismaClient } from '@prisma/client'
import { addAppDays, formatDayKey, getWeekBounds, parseDay } from '@/lib/dates'

// Before calendar days were pinned to Brasília, the Vercel server (UTC) stored
// them at 00:00Z of a yyyy-MM-dd — which a browser in Brasília shows as the
// previous day. Rows at exactly 00:00Z are those; a day written since the fix
// (or locally) is at 03:00Z and is never touched.
//
// Repairing keeps the stored yyyy-MM-dd. That is the intended day for dates
// typed in forms, the quiz and recurring copies, but the old day chips were
// themselves shifted ("SEG 4" for a week starting Monday 05/10), so a chip
// task can end up one day early. The ones that land outside their goal's week
// are certainly wrong: they are listed, and moved a day forward only on request.
// Others can't be told apart from the data; the user reviews them in the app.

export type OutsideWeekTask = { taskId: string; email: string; title: string; day: string; weekStart: string }
export type RepairCounts = { tasks: number; goals: number; objectives: number }
export type RepairPlan = RepairCounts & { outsideWeek: OutsideWeekTask[] }

export function isUtcMidnight(date: Date): boolean {
  return (
    date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0
  )
}

/** The same yyyy-MM-dd the old code stored, as 00:00 in Brasília. */
export function repairedDay(date: Date): Date {
  return parseDay(date.toISOString().slice(0, 10))
}

const repaired = (date: Date) => (isUtcMidnight(date) ? repairedDay(date) : date)

// Guests are excluded: their accounts expire on their own within a day.
const realUsers = { user: { isAnonymous: false } }

async function inspect(db: PrismaClient) {
  const [tasks, goals, objectives] = await Promise.all([
    db.dailyTask.findMany({
      where: { weeklyGoal: { objective: realUsers } },
      select: {
        id: true,
        title: true,
        date: true,
        weeklyGoal: { select: { weekStart: true, objective: { select: { user: { select: { email: true } } } } } },
      },
    }),
    db.weeklyGoal.findMany({ where: { objective: realUsers }, select: { id: true, weekStart: true } }),
    db.objective.findMany({ where: realUsers, select: { id: true, startDate: true, targetDate: true } }),
  ])

  const outsideWeek: OutsideWeekTask[] = []
  for (const task of tasks) {
    const day = repaired(task.date)
    const { weekStart, weekEnd } = getWeekBounds(repaired(task.weeklyGoal.weekStart))
    if (day < weekStart || day > weekEnd) {
      outsideWeek.push({
        taskId: task.id,
        email: task.weeklyGoal.objective.user.email,
        title: task.title,
        day: formatDayKey(day),
        weekStart: formatDayKey(weekStart),
      })
    }
  }

  return {
    tasks: tasks.filter((t) => isUtcMidnight(t.date)),
    goals: goals.filter((g) => isUtcMidnight(g.weekStart)),
    objectives: objectives.filter((o) => isUtcMidnight(o.startDate) || (o.targetDate && isUtcMidnight(o.targetDate))),
    outsideWeek,
  }
}

/** Dry run: what would change, plus tasks that would sit outside their week. Writes nothing. */
export async function planRepair(db: PrismaClient): Promise<RepairPlan> {
  const found = await inspect(db)
  return {
    tasks: found.tasks.length,
    goals: found.goals.length,
    objectives: found.objectives.length,
    outsideWeek: found.outsideWeek,
  }
}

/**
 * Moves every old row to its Brasília day, in one transaction. With
 * `moveOutsideWeek`, tasks that would sit one day before their week also move
 * a day forward (the old chips' shift).
 */
export async function applyRepair(
  db: PrismaClient,
  { moveOutsideWeek = false }: { moveOutsideWeek?: boolean } = {},
): Promise<RepairPlan> {
  const found = await inspect(db)
  const shiftForward = new Set(moveOutsideWeek ? found.outsideWeek.map((t) => t.taskId) : [])

  await db.$transaction(
    async (tx) => {
      for (const task of found.tasks) {
        const day = repairedDay(task.date)
        await tx.dailyTask.update({ where: { id: task.id }, data: { date: shiftForward.has(task.id) ? addAppDays(day, 1) : day } })
      }
      for (const goal of found.goals) {
        // weekEnd is recomputed from the repaired start rather than shifted on its own.
        await tx.weeklyGoal.update({ where: { id: goal.id }, data: getWeekBounds(repairedDay(goal.weekStart)) })
      }
      for (const objective of found.objectives) {
        await tx.objective.update({
          where: { id: objective.id },
          data: {
            startDate: repaired(objective.startDate),
            targetDate: objective.targetDate ? repaired(objective.targetDate) : objective.targetDate,
          },
        })
      }
    },
    { timeout: 60_000 },
  )

  return {
    tasks: found.tasks.length,
    goals: found.goals.length,
    objectives: found.objectives.length,
    outsideWeek: found.outsideWeek,
  }
}
