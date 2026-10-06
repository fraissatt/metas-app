import { prisma } from '@/lib/db'
import type { DailyTask, Objective, WeeklyGoal } from '@prisma/client'

export const NOT_FOUND = 'Não encontrado'

// A foreign record is indistinguishable from a missing one, so ids of other
// users' data cannot be probed.
export async function findOwnedObjective(userId: string, id: string): Promise<Objective> {
  const objective = await prisma.objective.findFirst({ where: { id, userId } })
  if (!objective) throw new Error(NOT_FOUND)
  return objective
}

export async function findOwnedWeeklyGoal(userId: string, id: string): Promise<WeeklyGoal> {
  const goal = await prisma.weeklyGoal.findFirst({ where: { id, objective: { userId } } })
  if (!goal) throw new Error(NOT_FOUND)
  return goal
}

export async function findOwnedDailyTask(userId: string, id: string): Promise<DailyTask> {
  const task = await prisma.dailyTask.findFirst({ where: { id, weeklyGoal: { objective: { userId } } } })
  if (!task) throw new Error(NOT_FOUND)
  return task
}
