import { describe, expect, it } from 'vitest'
import { parseISO } from 'date-fns'
import { prisma } from '@/lib/db'
import { getObjectiveProgressSeries } from '@/lib/actions/progress'
import { getWeekBounds } from '@/lib/dates'

describe('getObjectiveProgressSeries', () => {
  it('returns one point per weekly goal, ordered by week, with completion percent', async () => {
    const objective = await prisma.objective.create({ data: { title: 'Obj', startDate: new Date() } })
    // Use parseISO (not `new Date(string)`) for date-only strings: `new Date('2026-07-06')`
    // parses as UTC midnight, which in negative-UTC-offset timezones rolls back to the
    // previous local day — the same off-by-one-week bug already regression-tested in
    // weeklyGoals.test.ts. parseISO parses the date as local time, as intended here.
    const week1 = getWeekBounds(parseISO('2026-07-06'))
    const week2 = getWeekBounds(parseISO('2026-07-13'))

    const goal1 = await prisma.weeklyGoal.create({
      data: { title: 'W1', objectiveId: objective.id, ...week1 },
    })
    const goal2 = await prisma.weeklyGoal.create({
      data: { title: 'W2', objectiveId: objective.id, ...week2 },
    })
    await prisma.dailyTask.createMany({
      data: [
        { title: 'a', weeklyGoalId: goal1.id, date: week1.weekStart, completed: true },
        { title: 'b', weeklyGoalId: goal1.id, date: week1.weekStart, completed: false },
        { title: 'c', weeklyGoalId: goal2.id, date: week2.weekStart, completed: true },
      ],
    })

    const series = await getObjectiveProgressSeries(objective.id)

    expect(series).toEqual([
      { weekLabel: '06/07', percent: 50 },
      { weekLabel: '13/07', percent: 100 },
    ])
  })
})
