import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { getTodaySummary } from '@/lib/actions/summary'
import { getWeekBounds } from '@/lib/dates'

async function goal() {
  const objective = await prisma.objective.create({ data: { title: 'Obj', startDate: new Date('2026-09-01') } })
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
