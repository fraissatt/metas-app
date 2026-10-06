import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { getLifetimeStats } from '@/lib/actions/stats'
import { getWeekBounds } from '@/lib/dates'
import { TEST_USER_ID } from '@/test/session-mock'

async function makeGoal() {
  const objective = await prisma.objective.create({
    data: { userId: TEST_USER_ID, title: 'Obj', startDate: new Date() },
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
