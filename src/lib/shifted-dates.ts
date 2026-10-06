import type { PrismaClient } from '@prisma/client'
import { getWeekBounds, parseDay } from '@/lib/dates'

// Before calendar days were pinned to Brasília, the Vercel server (UTC) stored
// them at 00:00Z of the intended yyyy-MM-dd — which a browser in Brasília
// shows as the previous day. Rows at exactly 00:00Z are those; a day written
// since the fix (or locally) is at 03:00Z and is never touched.

export type RepairCounts = { tasks: number; goals: number; objectives: number }

export function isUtcMidnight(date: Date): boolean {
  return date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0
}

/** The same yyyy-MM-dd the old code meant, as 00:00 in Brasília. */
export function repairedDay(date: Date): Date {
  return parseDay(date.toISOString().slice(0, 10))
}

// Guests are excluded: their accounts expire on their own within a day.
const realUsers = { user: { isAnonymous: false } }

async function findShifted(db: PrismaClient) {
  const [tasks, goals, objectives] = await Promise.all([
    db.dailyTask.findMany({
      where: { weeklyGoal: { objective: realUsers } },
      select: { id: true, date: true },
    }),
    db.weeklyGoal.findMany({
      where: { objective: realUsers },
      select: { id: true, weekStart: true },
    }),
    db.objective.findMany({
      where: realUsers,
      select: { id: true, startDate: true, targetDate: true },
    }),
  ])

  return {
    tasks: tasks.filter((t) => isUtcMidnight(t.date)),
    goals: goals.filter((g) => isUtcMidnight(g.weekStart)),
    objectives: objectives.filter((o) => isUtcMidnight(o.startDate) || (o.targetDate && isUtcMidnight(o.targetDate))),
  }
}

/** Dry run: how many rows would change. Writes nothing. */
export async function planRepair(db: PrismaClient): Promise<RepairCounts> {
  const shifted = await findShifted(db)
  return { tasks: shifted.tasks.length, goals: shifted.goals.length, objectives: shifted.objectives.length }
}

/** Moves every old row to its Brasília day, in one transaction. */
export async function applyRepair(db: PrismaClient): Promise<RepairCounts> {
  const shifted = await findShifted(db)

  await db.$transaction(
    async (tx) => {
      for (const task of shifted.tasks) {
        await tx.dailyTask.update({ where: { id: task.id }, data: { date: repairedDay(task.date) } })
      }
      for (const goal of shifted.goals) {
        // weekEnd is recomputed from the repaired start rather than shifted on its own.
        await tx.weeklyGoal.update({ where: { id: goal.id }, data: getWeekBounds(repairedDay(goal.weekStart)) })
      }
      for (const objective of shifted.objectives) {
        await tx.objective.update({
          where: { id: objective.id },
          data: {
            startDate: isUtcMidnight(objective.startDate) ? repairedDay(objective.startDate) : objective.startDate,
            targetDate:
              objective.targetDate && isUtcMidnight(objective.targetDate)
                ? repairedDay(objective.targetDate)
                : objective.targetDate,
          },
        })
      }
    },
    { timeout: 60_000 },
  )

  return { tasks: shifted.tasks.length, goals: shifted.goals.length, objectives: shifted.objectives.length }
}
