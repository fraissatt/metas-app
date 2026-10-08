import { describe, expect, it } from 'vitest'
import { addDays, addWeeks, format } from 'date-fns'
import { prisma } from '@/lib/db'
import {
  countPendingRecurrences,
  getMissingGoalsPreview,
  listObjectiveWeeks,
  listWeeklyGoalsForCurrentWeek,
  listWeeklyGoalsForWeek,
  materializePendingWeek,
} from '@/lib/actions/weeklyGoals'
import { formatDayKey, getWeekBounds } from '@/lib/dates'
import { TEST_USER_ID, createTestUser } from '@/test/session-mock'

const ymd = (d: Date) => formatDayKey(d)

async function objective(userId = TEST_USER_ID) {
  return prisma.objective.create({ data: { userId, title: 'Obj', startDate: addWeeks(new Date(), -10) } })
}

async function goal(objectiveId: string, weeksFromNow: number, title: string, tasks: boolean[]) {
  const { weekStart, weekEnd } = getWeekBounds(addWeeks(new Date(), weeksFromNow))
  return prisma.weeklyGoal.create({
    data: {
      title,
      objectiveId,
      weekStart,
      weekEnd,
      dailyTasks: {
        create: tasks.map((completed, i) => ({
          title: `${title} ${i}`,
          date: addDays(weekStart, i),
          completed,
          completedAt: completed ? addDays(weekStart, i) : null,
        })),
      },
    },
  })
}

describe('listObjectiveWeeks', () => {
  it('returns the current and future weeks in full, oldest first', async () => {
    const o = await objective()
    await goal(o.id, 1, 'Próxima', [false])
    await goal(o.id, 0, 'Atual', [true, false])
    await goal(o.id, -1, 'Passada', [true])

    const { current } = await listObjectiveWeeks(o.id)
    expect(current.map((g) => g.title)).toEqual(['Atual', 'Próxima'])
    expect(current[0].dailyTasks).toHaveLength(2)
  })

  it("lists each goal's tasks ordered by date", async () => {
    const o = await objective()
    const { weekStart, weekEnd } = getWeekBounds(new Date())
    const g = await prisma.weeklyGoal.create({ data: { title: 'Meta', objectiveId: o.id, weekStart, weekEnd } })
    const later = await prisma.dailyTask.create({ data: { title: 'Depois', weeklyGoalId: g.id, date: addDays(weekStart, 3) } })
    const earlier = await prisma.dailyTask.create({ data: { title: 'Antes', weeklyGoalId: g.id, date: addDays(weekStart, 1) } })

    const { current } = await listObjectiveWeeks(o.id)
    expect(current[0].dailyTasks.map((t) => t.id)).toEqual([earlier.id, later.id])
  })

  it('summarises each earlier week once, newest first, adding up every goal of that week', async () => {
    const o = await objective()
    await goal(o.id, -1, 'A', [true, true, false])
    await goal(o.id, -1, 'B', [true])
    await goal(o.id, -3, 'C', [false, false])

    const { past } = await listObjectiveWeeks(o.id)
    expect(past).toEqual([
      { weekStart: ymd(getWeekBounds(addWeeks(new Date(), -1)).weekStart), total: 4, completed: 3 },
      { weekStart: ymd(getWeekBounds(addWeeks(new Date(), -3)).weekStart), total: 2, completed: 0 },
    ])
  })

  it("never includes another user's weeks", async () => {
    await createTestUser('other')
    const foreign = await objective('other')
    await goal(foreign.id, 0, 'Alheia', [true])
    await goal(foreign.id, -1, 'Alheia antiga', [true])

    expect(await listObjectiveWeeks(foreign.id)).toEqual({ current: [], past: [] })
  })
})

describe('listWeeklyGoalsForWeek', () => {
  it("loads one earlier week's goals with their tasks", async () => {
    const o = await objective()
    await goal(o.id, -2, 'Semana 2', [true, false])
    await goal(o.id, -1, 'Semana 1', [true])

    const week = ymd(getWeekBounds(addWeeks(new Date(), -2)).weekStart)
    const goals = await listWeeklyGoalsForWeek(o.id, week)
    expect(goals.map((g) => g.title)).toEqual(['Semana 2'])
    expect(goals[0].dailyTasks.map((t) => t.completed)).toEqual([true, false])
  })

  it("returns nothing for another user's objective or an invalid date", async () => {
    await createTestUser('other')
    const foreign = await objective('other')
    await goal(foreign.id, -1, 'Alheia', [true])
    const week = ymd(getWeekBounds(addWeeks(new Date(), -1)).weekStart)

    expect(await listWeeklyGoalsForWeek(foreign.id, week)).toEqual([])
    expect(await listWeeklyGoalsForWeek(foreign.id, 'not-a-date')).toEqual([])
  })
})

describe('rows written at 00:00Z by the old UTC server, before the repair runs', () => {
  // The old code stored a week's Monday at 00:00Z, i.e. 3 h before 00:00 in Brasília.
  const legacy = (date: Date) => new Date(date.getTime() - 3 * 3600_000)

  it('keeps legacy current-week goals in the current week and never re-creates them', async () => {
    const o = await objective()
    const { weekStart, weekEnd } = getWeekBounds(new Date())
    await prisma.weeklyGoal.create({
      data: { title: 'Recorrente', objectiveId: o.id, recurring: true, weekStart: legacy(weekStart), weekEnd: legacy(weekEnd) },
    })

    expect((await listWeeklyGoalsForCurrentWeek()).map((g) => g.title)).toEqual(['Recorrente'])
    expect(await countPendingRecurrences()).toBe(0)
    expect(await getMissingGoalsPreview()).toBeNull()
    await materializePendingWeek()
    expect(await prisma.weeklyGoal.count()).toBe(1)
    expect((await listObjectiveWeeks(o.id)).current.map((g) => g.title)).toEqual(['Recorrente'])
  })

  it('keys a legacy earlier week by its Monday and loads it from that key', async () => {
    const o = await objective()
    const { weekStart, weekEnd } = getWeekBounds(addWeeks(new Date(), -1))
    await prisma.weeklyGoal.create({
      data: { title: 'Antiga', objectiveId: o.id, weekStart: legacy(weekStart), weekEnd: legacy(weekEnd) },
    })

    const { past } = await listObjectiveWeeks(o.id)
    expect(past.map((w) => w.weekStart)).toEqual([ymd(weekStart)])
    expect((await listWeeklyGoalsForWeek(o.id, ymd(weekStart))).map((g) => g.title)).toEqual(['Antiga'])
  })
})
