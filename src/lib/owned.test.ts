import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { findOwnedDailyTask, findOwnedObjective, findOwnedWeeklyGoal, NOT_FOUND } from '@/lib/owned'
import { TEST_USER_ID, createTestUser } from '@/test/session-mock'

async function tree(userId: string) {
  const objective = await prisma.objective.create({ data: { title: 'O', startDate: new Date(), userId } })
  const goal = await prisma.weeklyGoal.create({
    data: { title: 'G', objectiveId: objective.id, weekStart: new Date(), weekEnd: new Date() },
  })
  const task = await prisma.dailyTask.create({ data: { title: 'T', weeklyGoalId: goal.id, date: new Date() } })
  return { objective, goal, task }
}

describe('owned lookups', () => {
  it('return records owned by the user', async () => {
    const t = await tree(TEST_USER_ID)
    expect((await findOwnedObjective(TEST_USER_ID, t.objective.id)).id).toBe(t.objective.id)
    expect((await findOwnedWeeklyGoal(TEST_USER_ID, t.goal.id)).id).toBe(t.goal.id)
    expect((await findOwnedDailyTask(TEST_USER_ID, t.task.id)).id).toBe(t.task.id)
  })

  it("reject another user's records exactly like missing ids", async () => {
    await createTestUser('other')
    const t = await tree('other')
    await expect(findOwnedObjective(TEST_USER_ID, t.objective.id)).rejects.toThrow(NOT_FOUND)
    await expect(findOwnedWeeklyGoal(TEST_USER_ID, t.goal.id)).rejects.toThrow(NOT_FOUND)
    await expect(findOwnedDailyTask(TEST_USER_ID, t.task.id)).rejects.toThrow(NOT_FOUND)
    await expect(findOwnedObjective(TEST_USER_ID, 'missing')).rejects.toThrow(NOT_FOUND)
  })
})
