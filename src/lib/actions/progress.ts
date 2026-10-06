'use server'

import { format } from 'date-fns'
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
    weekLabel: format(week.weekStart, 'dd/MM'),
    percent: week.total === 0 ? 0 : Math.round((week.completed / week.total) * 100),
  }))
}
