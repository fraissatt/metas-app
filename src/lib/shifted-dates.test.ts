import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { applyRepair, isUtcMidnight, planRepair, repairedDay } from '@/lib/shifted-dates'
import { parseDay } from '@/lib/dates'
import { TEST_USER_ID, createTestUser } from '@/test/session-mock'

describe('shifted dates repair', () => {
  it('recognises rows written at 00:00Z and maps them to the same day in Brasília', () => {
    expect(isUtcMidnight(new Date('2026-10-04T00:00:00Z'))).toBe(true)
    expect(isUtcMidnight(parseDay('2026-10-04'))).toBe(false)
    expect(repairedDay(new Date('2026-10-04T00:00:00Z')).toISOString()).toBe('2026-10-04T03:00:00.000Z')
  })

  it('dry run counts but changes nothing; apply fixes only old rows', async () => {
    const objective = await prisma.objective.create({
      data: {
        userId: TEST_USER_ID,
        title: 'O',
        startDate: new Date('2026-10-05T00:00:00Z'),
        targetDate: parseDay('2026-12-01'),
      },
    })
    const goal = await prisma.weeklyGoal.create({
      data: {
        title: 'G',
        objectiveId: objective.id,
        weekStart: new Date('2026-10-05T00:00:00Z'),
        weekEnd: new Date('2026-10-11T23:59:59.999Z'),
      },
    })
    const old = await prisma.dailyTask.create({ data: { title: 'old', weeklyGoalId: goal.id, date: new Date('2026-10-06T00:00:00Z') } })
    const fresh = await prisma.dailyTask.create({ data: { title: 'new', weeklyGoalId: goal.id, date: parseDay('2026-10-07') } })

    expect(await planRepair(prisma)).toEqual({ tasks: 1, goals: 1, objectives: 1 })
    expect((await prisma.dailyTask.findUniqueOrThrow({ where: { id: old.id } })).date.toISOString()).toBe(
      '2026-10-06T00:00:00.000Z',
    )

    expect(await applyRepair(prisma)).toEqual({ tasks: 1, goals: 1, objectives: 1 })
    expect((await prisma.dailyTask.findUniqueOrThrow({ where: { id: old.id } })).date.toISOString()).toBe(
      '2026-10-06T03:00:00.000Z',
    )
    expect((await prisma.dailyTask.findUniqueOrThrow({ where: { id: fresh.id } })).date.toISOString()).toBe(
      '2026-10-07T03:00:00.000Z',
    )
    const g = await prisma.weeklyGoal.findUniqueOrThrow({ where: { id: goal.id } })
    expect(g.weekStart.toISOString()).toBe('2026-10-05T03:00:00.000Z')
    expect(g.weekEnd.toISOString()).toBe('2026-10-12T02:59:59.999Z')
    const o = await prisma.objective.findUniqueOrThrow({ where: { id: objective.id } })
    expect(o.startDate.toISOString()).toBe('2026-10-05T03:00:00.000Z')
    expect(o.targetDate?.toISOString()).toBe('2026-12-01T03:00:00.000Z')
    expect(await planRepair(prisma)).toEqual({ tasks: 0, goals: 0, objectives: 0 })
  })

  it('leaves guest accounts alone', async () => {
    await createTestUser('guest-x', { isAnonymous: true })
    const objective = await prisma.objective.create({
      data: { userId: 'guest-x', title: 'O', startDate: new Date('2026-10-05T00:00:00Z') },
    })
    await prisma.weeklyGoal.create({
      data: {
        title: 'G',
        objectiveId: objective.id,
        weekStart: new Date('2026-10-05T00:00:00Z'),
        weekEnd: new Date('2026-10-11T23:59:59.999Z'),
      },
    })
    expect(await planRepair(prisma)).toEqual({ tasks: 0, goals: 0, objectives: 0 })
  })
})
