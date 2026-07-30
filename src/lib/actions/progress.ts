'use server'

import { format } from 'date-fns'
import { prisma } from '@/lib/db'
import { getWeekProgress } from '@/lib/actions/weeklyGoals'

export async function getObjectiveProgressSeries(
  objectiveId: string,
): Promise<Array<{ weekLabel: string; percent: number }>> {
  const weeklyGoals = await prisma.weeklyGoal.findMany({
    where: { objectiveId },
    orderBy: { weekStart: 'asc' },
  })

  const series = await Promise.all(
    weeklyGoals.map(async (goal) => {
      const { percent } = await getWeekProgress(goal.id)
      return { weekLabel: format(goal.weekStart, 'dd/MM'), percent }
    }),
  )

  return series
}
