import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { finishWeekReview, getWeekReview, getWeekReviewInvite } from '@/lib/actions/weekReview'
import { getMissingGoalsPreview } from '@/lib/actions/weeklyGoals'
import { formatDayKey, getWeekBounds, parseDay } from '@/lib/dates'
import { TEST_USER_ID, createTestUser } from '@/test/session-mock'

// Last week: 2026-10-19 → 25. Current week (Monday 26): 2026-10-26 → 11-01.
const LAST = parseDay('2026-10-19')
const CURRENT = parseDay('2026-10-26')
const NEXT = parseDay('2026-11-02')

function setNow(iso: string) {
  vi.setSystemTime(new Date(iso))
}

async function makeObjective(userId = TEST_USER_ID, status: 'ACTIVE' | 'COMPLETED' = 'ACTIVE', title = 'Saúde') {
  return prisma.objective.create({ data: { userId, title, status, startDate: LAST } })
}

async function makeGoal(
  objectiveId: string,
  weekStart: Date,
  title: string,
  tasks: Array<[string, boolean]> = [],
  recurring = false,
) {
  const goal = await prisma.weeklyGoal.create({
    data: { objectiveId, title, weekStart, weekEnd: getWeekBounds(weekStart).weekEnd, recurring },
  })
  for (const [day, completed] of tasks) {
    await prisma.dailyTask.create({ data: { weeklyGoalId: goal.id, title: `${title} ${day}`, date: parseDay(day), completed } })
  }
  return goal
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  setNow('2026-10-26T12:00:00-03:00') // Monday
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getWeekReview', () => {
  it('is null when nothing was ever planned', async () => {
    expect(await getWeekReview()).toBeNull()
  })

  it('reviews the last planned week on a weekday, with the compound effect before it', async () => {
    const objective = await makeObjective()
    await makeGoal(objective.id, parseDay('2026-10-12'), 'Antes', [['2026-10-12', true]])
    await makeGoal(objective.id, LAST, 'Correr', [
      ['2026-10-19', true],
      ['2026-10-20', false],
    ])

    const review = await getWeekReview()

    expect(review?.weekKey).toBe('2026-10-19')
    expect(review?.repeatInto).toBe('current')
    expect(review?.daysDone).toBe(1)
    expect(review?.tasksCompleted).toBe(1)
    expect(review?.previousDelta).toBe(0)
    expect(review?.compound.before).toBeCloseTo(1.01)
    expect(review?.compound.after).toBeCloseTo(1.01 ** 2)
    expect(review?.goals.map((goal) => goal.repeat)).toEqual(['choose'])
  })

  it('reviews the current week on Sunday and marks goals already planned for next week', async () => {
    setNow('2026-11-01T12:00:00-03:00')
    const objective = await makeObjective()
    await makeGoal(objective.id, CURRENT, 'Correr')
    await makeGoal(objective.id, CURRENT, 'Ler')
    await makeGoal(objective.id, NEXT, 'Ler')

    const review = await getWeekReview()

    expect(review?.weekKey).toBe('2026-10-26')
    expect(review?.repeatInto).toBe('next')
    expect(review?.goals.map((goal) => [goal.title, goal.repeat])).toEqual([
      ['Correr', 'choose'],
      ['Ler', 'planned'],
    ])
  })

  it("never shows another user's goals", async () => {
    await createTestUser('other')
    const theirs = await makeObjective('other')
    await makeGoal(theirs.id, LAST, 'Deles')

    expect(await getWeekReview()).toBeNull()
  })
})

describe('getWeekReviewInvite', () => {
  it('invites on Monday for last week, and stops once reviewed', async () => {
    const objective = await makeObjective()
    await makeGoal(objective.id, LAST, 'Correr', [['2026-10-19', true]])

    expect(await getWeekReviewInvite()).toMatchObject({ weekKey: '2026-10-19', daysDone: 1, tasksCompleted: 1 })

    await finishWeekReview('2026-10-19', [])

    expect(await getWeekReviewInvite()).toBeNull()
  })

  it('does not invite on Thursday', async () => {
    setNow('2026-10-29T12:00:00-03:00')
    const objective = await makeObjective()
    await makeGoal(objective.id, LAST, 'Correr')

    expect(await getWeekReviewInvite()).toBeNull()
  })
})

describe('finishWeekReview', () => {
  it('repeats only the ticked one-off goals into the current week, keeping weekdays', async () => {
    const objective = await makeObjective()
    const keep = await makeGoal(objective.id, LAST, 'Correr', [['2026-10-21', true]])
    await makeGoal(objective.id, LAST, 'Ler', [['2026-10-19', false]])

    await finishWeekReview('2026-10-19', [keep.id])

    const current = await prisma.weeklyGoal.findMany({ where: { weekStart: CURRENT }, include: { dailyTasks: true } })
    expect(current.map((goal) => goal.title)).toEqual(['Correr'])
    expect(formatDayKey(current[0].dailyTasks[0].date)).toBe('2026-10-28')
    expect(current[0].dailyTasks[0].completed).toBe(false)
    expect(await prisma.weekReview.count({ where: { userId: TEST_USER_ID, weekStart: LAST } })).toBe(1)
  })

  it('repeats into next week when reviewing the current week at the weekend', async () => {
    setNow('2026-11-01T12:00:00-03:00')
    const objective = await makeObjective()
    const goal = await makeGoal(objective.id, CURRENT, 'Correr')

    await finishWeekReview('2026-10-26', [goal.id])

    expect(await prisma.weeklyGoal.count({ where: { weekStart: NEXT, title: 'Correr' } })).toBe(1)
  })

  it('is idempotent: a second run creates nothing twice and refreshes the review', async () => {
    const objective = await makeObjective()
    const goal = await makeGoal(objective.id, LAST, 'Correr')

    await finishWeekReview('2026-10-19', [goal.id])
    await finishWeekReview('2026-10-19', [goal.id])

    expect(await prisma.weeklyGoal.count({ where: { weekStart: CURRENT } })).toBe(1)
    expect(await prisma.weekReview.count()).toBe(1)
  })

  it('ignores recurring goals, completed objectives and other users', async () => {
    const objective = await makeObjective()
    const closed = await makeObjective(TEST_USER_ID, 'COMPLETED', 'Feito')
    await createTestUser('other')
    const theirs = await makeObjective('other')
    const ids = [
      (await makeGoal(objective.id, LAST, 'Alongar', [], true)).id,
      (await makeGoal(closed.id, LAST, 'Fechado')).id,
      (await makeGoal(theirs.id, LAST, 'Deles')).id,
    ]

    await finishWeekReview('2026-10-19', ids)

    expect(await prisma.weeklyGoal.count({ where: { weekStart: CURRENT } })).toBe(0)
  })

  it('rejects a future week and an invalid key', async () => {
    await expect(finishWeekReview('2026-11-02', [])).rejects.toThrow()
    await expect(finishWeekReview('ontem', [])).rejects.toThrow()
    expect(await prisma.weekReview.count()).toBe(0)
  })
})

describe('getMissingGoalsPreview after a review', () => {
  it('stops offering the goals of a reviewed week', async () => {
    const objective = await makeObjective()
    await makeGoal(objective.id, LAST, 'Correr')
    expect(await getMissingGoalsPreview()).not.toBeNull()

    await finishWeekReview('2026-10-19', [])

    expect(await getMissingGoalsPreview()).toBeNull()
  })
})
