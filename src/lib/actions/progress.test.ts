import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { getObjectiveProgressSeries } from '@/lib/actions/progress'
import { getWeekBounds, parseDay } from '@/lib/dates'
import { NOT_FOUND } from '@/lib/owned'
import { TEST_USER_ID, createTestUser } from '@/test/session-mock'

describe('getObjectiveProgressSeries', () => {
  it('returns one point per week, ordered by week, with completion percent', async () => {
    const objective = await prisma.objective.create({ data: { userId: TEST_USER_ID, title: 'Obj', startDate: new Date() } })
    // Weeks are Brasília weeks: parseDay builds each Monday as 00:00 there, whatever
    // time zone the suite runs in (npm run test:tz).
    const week1 = getWeekBounds(parseDay('2026-07-06'))
    const week2 = getWeekBounds(parseDay('2026-07-13'))

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

  it('emits one point per week when an objective has several goals in the same week', async () => {
    const objective = await prisma.objective.create({ data: { userId: TEST_USER_ID, title: 'Obj', startDate: new Date() } })
    const week = getWeekBounds(parseDay('2026-07-06'))

    const first = await prisma.weeklyGoal.create({
      data: { title: 'Primeira', objectiveId: objective.id, ...week },
    })
    const second = await prisma.weeklyGoal.create({
      data: { title: 'Segunda', objectiveId: objective.id, ...week },
    })
    await prisma.dailyTask.createMany({
      data: [
        { title: 'a', weeklyGoalId: first.id, date: week.weekStart, completed: true },
        { title: 'b', weeklyGoalId: first.id, date: week.weekStart, completed: true },
        { title: 'c', weeklyGoalId: second.id, date: week.weekStart, completed: false },
        { title: 'd', weeklyGoalId: second.id, date: week.weekStart, completed: false },
      ],
    })

    const series = await getObjectiveProgressSeries(objective.id)

    // One bar, not two with identical labels; the percent spans both goals.
    expect(series).toEqual([{ weekLabel: '06/07', percent: 50 }])
  })

  it('reports 0% for a week whose goal has no tasks', async () => {
    const objective = await prisma.objective.create({ data: { userId: TEST_USER_ID, title: 'Obj', startDate: new Date() } })
    const week = getWeekBounds(parseDay('2026-07-06'))
    await prisma.weeklyGoal.create({
      data: { title: 'Vazia', objectiveId: objective.id, ...week },
    })

    expect(await getObjectiveProgressSeries(objective.id)).toEqual([
      { weekLabel: '06/07', percent: 0 },
    ])
  })
})

describe('getObjectiveProgressSeries isolation', () => {
  it("rejects another user's objective", async () => {
    await createTestUser('other')
    const foreignObjective = await prisma.objective.create({
      data: { userId: 'other', title: 'Objetivo Alheio', startDate: new Date() },
    })
    const foreignGoal = await prisma.weeklyGoal.create({
      data: { title: 'Meta Alheio', objectiveId: foreignObjective.id, ...getWeekBounds(new Date()) },
    })
    await prisma.dailyTask.create({
      data: { title: 'Tarefa Alheio', weeklyGoalId: foreignGoal.id, date: new Date(), completed: true, completedAt: new Date() },
    })
    await expect(getObjectiveProgressSeries(foreignObjective.id)).rejects.toThrow(NOT_FOUND)
  })
})
