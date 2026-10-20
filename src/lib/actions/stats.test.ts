import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { getDayDots, getLifetimeStats } from '@/lib/actions/stats'
import { appYear, getWeekBounds, getYearDays, parseDay } from '@/lib/dates'
import { TEST_USER_ID, createTestUser } from '@/test/session-mock'

async function makeGoal(userId = TEST_USER_ID) {
  const objective = await prisma.objective.create({
    data: { userId, title: 'Obj', startDate: new Date() },
  })
  const bounds = getWeekBounds(new Date())
  return prisma.weeklyGoal.create({
    data: { title: 'Goal', objectiveId: objective.id, ...bounds },
  })
}

describe('getLifetimeStats', () => {
  it('returns an empty result for an empty database', async () => {
    expect(await getLifetimeStats()).toEqual({
      totalCompleted: 0,
      firstCompletedAt: null,
      weekWindow: [],
    })
  })

  it('counts only completed tasks', async () => {
    const goal = await makeGoal()
    const now = new Date()
    await prisma.dailyTask.createMany({
      data: [
        { title: 'A', weeklyGoalId: goal.id, date: now, completed: true, completedAt: now },
        { title: 'B', weeklyGoalId: goal.id, date: now, completed: true, completedAt: now },
        { title: 'C', weeklyGoalId: goal.id, date: now, completed: false },
      ],
    })

    const stats = await getLifetimeStats()

    expect(stats.totalCompleted).toBe(2)
  })

  it('reports the earliest completion timestamp', async () => {
    const goal = await makeGoal()
    const older = new Date(2026, 6, 29, 8)
    const newer = new Date(2026, 7, 18, 8)
    await prisma.dailyTask.createMany({
      data: [
        { title: 'Newer', weeklyGoalId: goal.id, date: newer, completed: true, completedAt: newer },
        { title: 'Older', weeklyGoalId: goal.id, date: older, completed: true, completedAt: older },
      ],
    })

    const stats = await getLifetimeStats()

    expect(stats.firstCompletedAt).toEqual(older)
  })

  it('counts a completed task with a null completedAt in the total but leaves it out of the window', async () => {
    // Only reachable by writing to the DB directly — `toggleDailyTask` always
    // sets `completed` and `completedAt` together. Such a row cannot be placed
    // in a week, so it is deliberately excluded from the window rather than
    // treated as an error.
    const goal = await makeGoal()
    const now = new Date()
    await prisma.dailyTask.createMany({
      data: [
        { title: 'Orphan', weeklyGoalId: goal.id, date: now, completed: true, completedAt: null },
        { title: 'Normal', weeklyGoalId: goal.id, date: now, completed: true, completedAt: now },
      ],
    })

    const stats = await getLifetimeStats()

    expect(stats.totalCompleted).toBe(2)
    expect(stats.weekWindow).toHaveLength(1)
    expect(stats.weekWindow[0].active).toBe(true)
  })
})

describe('getLifetimeStats isolation', () => {
  it("ignores another user's completed tasks", async () => {
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
    expect(await getLifetimeStats()).toMatchObject({ totalCompleted: 0, firstCompletedAt: null })
  })
})

describe('getDayDots', () => {
  it('returns the current year with every dot empty for a new user', async () => {
    const result = await getDayDots()
    const year = appYear(new Date())

    expect(result.year).toBe(year)
    expect(result.dots).toHaveLength(getYearDays(year).length)
    expect(result.dots.every((dot) => dot.tone === 'empty')).toBe(true)
    expect(result).toMatchObject({ daysDone: 0, firstYear: year, currentYear: year })
  })

  it("lights only the user's own days and counts days done all-time", async () => {
    const goal = await makeGoal()
    await createTestUser('other')
    const otherGoal = await makeGoal('other')
    await prisma.dailyTask.createMany({
      data: [
        { title: 'A', weeklyGoalId: goal.id, date: parseDay('2026-10-05'), completed: true },
        { title: 'B', weeklyGoalId: goal.id, date: parseDay('2025-03-01'), completed: true },
        { title: 'C', weeklyGoalId: otherGoal.id, date: parseDay('2026-10-06'), completed: true },
      ],
    })

    const result = await getDayDots(2026)
    const lit = result.dots.filter((dot) => dot.tone !== 'empty').map((dot) => dot.key)

    expect(lit).toEqual(['2026-10-05'])
    expect(result.daysDone).toBe(2)
  })

  it('starts firstYear at the earliest task year and reads past years', async () => {
    const goal = await makeGoal()
    await prisma.dailyTask.create({
      data: { title: 'Old', weeklyGoalId: goal.id, date: parseDay('2025-03-01'), completed: true },
    })

    const result = await getDayDots(2025)

    expect(result.firstYear).toBe(2025)
    expect(result.year).toBe(2025)
    expect(result.dots.find((dot) => dot.key === '2025-03-01')?.tone).toBe('done')
  })

  it('clamps a year outside firstYear..currentYear', async () => {
    const year = appYear(new Date())
    expect((await getDayDots(1999)).year).toBe(year)
    expect((await getDayDots(year + 5)).year).toBe(year)
  })
})
