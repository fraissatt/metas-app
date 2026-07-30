import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import {
  createWeeklyGoal,
  deleteWeeklyGoal,
  getWeekProgress,
  getWeeklyGoal,
  listWeeklyGoalsByObjective,
  listWeeklyGoalsForCurrentWeek,
  updateWeeklyGoal,
} from '@/lib/actions/weeklyGoals'
import { getWeekBounds } from '@/lib/dates'

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) fd.set(key, value)
  return fd
}

async function makeObjective() {
  return prisma.objective.create({ data: { title: 'Obj', startDate: new Date() } })
}

describe('weekly goal actions', () => {
  it('creates a weekly goal with computed Monday-Sunday bounds', async () => {
    const objective = await makeObjective()

    await createWeeklyGoal(objective.id, formData({ title: 'Correr 3x', weekOf: '2026-07-29' }))

    const goals = await prisma.weeklyGoal.findMany()
    expect(goals).toHaveLength(1)
    expect(goals[0].weekStart.getDate()).toBe(27)
    expect(goals[0].weekEnd.getDate()).toBe(2)
  })

  it('lists weekly goals for an objective ordered by week start', async () => {
    const objective = await makeObjective()
    const later = getWeekBounds(new Date('2026-08-10'))
    const earlier = getWeekBounds(new Date('2026-07-29'))
    const laterGoal = await prisma.weeklyGoal.create({
      data: { title: 'Later', objectiveId: objective.id, ...later },
    })
    const earlierGoal = await prisma.weeklyGoal.create({
      data: { title: 'Earlier', objectiveId: objective.id, ...earlier },
    })

    const result = await listWeeklyGoalsByObjective(objective.id)

    expect(result.map((g) => g.id)).toEqual([earlierGoal.id, laterGoal.id])
  })

  it('gets, updates, and deletes a weekly goal', async () => {
    const objective = await makeObjective()
    const bounds = getWeekBounds(new Date('2026-07-29'))
    const goal = await prisma.weeklyGoal.create({
      data: { title: 'Original', objectiveId: objective.id, ...bounds },
    })

    expect((await getWeeklyGoal(goal.id))?.title).toBe('Original')

    await updateWeeklyGoal(goal.id, formData({ title: 'Renamed', weekOf: '2026-07-29' }))
    expect((await prisma.weeklyGoal.findUnique({ where: { id: goal.id } }))?.title).toBe('Renamed')

    await deleteWeeklyGoal(goal.id)
    expect(await prisma.weeklyGoal.findUnique({ where: { id: goal.id } })).toBeNull()
  })

  it('computes week progress from daily tasks', async () => {
    const objective = await makeObjective()
    const bounds = getWeekBounds(new Date('2026-07-29'))
    const goal = await prisma.weeklyGoal.create({
      data: { title: 'Goal', objectiveId: objective.id, ...bounds },
    })
    await prisma.dailyTask.createMany({
      data: [
        { title: 'A', weeklyGoalId: goal.id, date: new Date('2026-07-27'), completed: true },
        { title: 'B', weeklyGoalId: goal.id, date: new Date('2026-07-28'), completed: false },
      ],
    })

    const progress = await getWeekProgress(goal.id)

    expect(progress).toEqual({ total: 2, completed: 1, percent: 50 })
  })

  it('lists weekly goals covering the current week across objectives', async () => {
    const objective = await makeObjective()
    const currentBounds = getWeekBounds(new Date())
    const currentGoal = await prisma.weeklyGoal.create({
      data: { title: 'Current', objectiveId: objective.id, ...currentBounds },
    })
    const pastBounds = getWeekBounds(new Date('2020-01-06'))
    await prisma.weeklyGoal.create({
      data: { title: 'Past', objectiveId: objective.id, ...pastBounds },
    })

    const result = await listWeeklyGoalsForCurrentWeek()

    expect(result.map((g) => g.id)).toEqual([currentGoal.id])
    expect(result[0].objective.id).toBe(objective.id)
  })
})
