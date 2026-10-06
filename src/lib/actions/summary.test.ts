import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { getTodaySummary } from '@/lib/actions/summary'
import { getWeekBounds, parseDay } from '@/lib/dates'
import { TEST_USER_ID, createTestUser } from '@/test/session-mock'

async function goal() {
  const objective = await prisma.objective.create({ data: { userId: TEST_USER_ID, title: 'Obj', startDate: new Date('2026-09-01') } })
  return prisma.weeklyGoal.create({
    data: { title: 'Meta', objectiveId: objective.id, ...getWeekBounds(new Date('2026-10-01T12:00:00')) },
  })
}

describe('getTodaySummary', () => {
  const now = new Date('2026-10-01T15:00:00')

  it("counts only today's tasks and how many are done", async () => {
    const g = await goal()
    await prisma.dailyTask.createMany({
      data: [
        { title: 'a', weeklyGoalId: g.id, date: new Date('2026-10-01T09:00:00'), completed: true },
        { title: 'b', weeklyGoalId: g.id, date: new Date('2026-10-01T18:00:00'), completed: false },
        { title: 'c', weeklyGoalId: g.id, date: new Date('2026-10-02T09:00:00'), completed: true },
      ],
    })

    const summary = await getTodaySummary(now)

    expect(summary.total).toBe(2)
    expect(summary.completed).toBe(1)
  })

  it('reports an empty day as zero of zero', async () => {
    expect(await getTodaySummary(now)).toMatchObject({ completed: 0, total: 0 })
  })

  it('returns the Monday of the current week', async () => {
    const { weekStart } = await getTodaySummary(now)
    expect(weekStart.getDay()).toBe(1)
    expect(weekStart.getDate()).toBe(28)
  })
})

describe('getTodaySummary isolation', () => {
  it("ignores another user's tasks", async () => {
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
    expect(await getTodaySummary()).toMatchObject({ completed: 0, total: 0 })
  })
})

describe('getTodaySummary around midnight UTC', () => {
  it('counts the Brasília day at 22:30 even though UTC is already the next day', async () => {
    const objective = await prisma.objective.create({ data: { userId: TEST_USER_ID, title: 'O', startDate: parseDay('2026-10-01') } })
    const goal = await prisma.weeklyGoal.create({
      data: { title: 'G', objectiveId: objective.id, ...getWeekBounds(parseDay('2026-10-06')) },
    })
    await prisma.dailyTask.create({ data: { title: 'hoje', weeklyGoalId: goal.id, date: parseDay('2026-10-06') } })
    await prisma.dailyTask.create({ data: { title: 'amanhã', weeklyGoalId: goal.id, date: parseDay('2026-10-07') } })
    expect(await getTodaySummary(new Date('2026-10-07T01:30:00Z'))).toMatchObject({ total: 1 })
  })
})
