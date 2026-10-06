import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { TEST_USER_ID } from '@/test/session-mock'

describe('prisma test database', () => {
  it('creates and reads an Objective', async () => {
    const objective = await prisma.objective.create({
      data: { userId: TEST_USER_ID, title: 'Aprender React', startDate: new Date('2026-01-01') },
    })

    const found = await prisma.objective.findUnique({ where: { id: objective.id } })

    expect(found?.title).toBe('Aprender React')
  })

  it('deleting a user cascades to objectives, goals and tasks', async () => {
    const objective = await prisma.objective.create({
      data: { title: 'O', startDate: new Date(), userId: TEST_USER_ID },
    })
    const goal = await prisma.weeklyGoal.create({
      data: { title: 'G', objectiveId: objective.id, weekStart: new Date(), weekEnd: new Date() },
    })
    await prisma.dailyTask.create({ data: { title: 'T', weeklyGoalId: goal.id, date: new Date() } })

    await prisma.user.delete({ where: { id: TEST_USER_ID } })

    expect(await prisma.objective.count()).toBe(0)
    expect(await prisma.weeklyGoal.count()).toBe(0)
    expect(await prisma.dailyTask.count()).toBe(0)
  })
})
