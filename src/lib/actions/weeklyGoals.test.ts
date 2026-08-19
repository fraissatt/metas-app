import { describe, expect, it } from 'vitest'
import { addWeeks, format } from 'date-fns'
import { prisma } from '@/lib/db'
import {
  createWeeklyGoal,
  deleteWeeklyGoal,
  getMissingGoalsPreview,
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
  it('rejects an empty title', async () => {
    const objective = await makeObjective()

    await expect(
      createWeeklyGoal(objective.id, formData({ title: '  ', weekOf: '2026-07-29' })),
    ).rejects.toThrow()
    expect(await prisma.weeklyGoal.findMany()).toHaveLength(0)
  })

  it('rejects an unparseable weekOf', async () => {
    const objective = await makeObjective()

    await expect(
      createWeeklyGoal(objective.id, formData({ title: 'Correr 3x', weekOf: 'not-a-date' })),
    ).rejects.toThrow()
    expect(await prisma.weeklyGoal.findMany()).toHaveLength(0)
  })

  it('creates a weekly goal with computed Monday-Sunday bounds', async () => {
    const objective = await makeObjective()

    await createWeeklyGoal(objective.id, formData({ title: 'Correr 3x', weekOf: '2026-07-29' }))

    const goals = await prisma.weeklyGoal.findMany()
    expect(goals).toHaveLength(1)
    expect(goals[0].weekStart.getDate()).toBe(27)
    expect(goals[0].weekEnd.getDate()).toBe(2)
  })

  it('creates a weekly goal with Monday date string (regression test for UTC off-by-one-week bug)', async () => {
    const objective = await makeObjective()

    await createWeeklyGoal(objective.id, formData({ title: 'Monday Test', weekOf: '2026-07-27' }))

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

  it("includes each goal's daily tasks ordered by date", async () => {
    const objective = await makeObjective()
    const bounds = getWeekBounds(new Date('2026-07-29'))
    const goal = await prisma.weeklyGoal.create({
      data: { title: 'Goal', objectiveId: objective.id, ...bounds },
    })
    const later = await prisma.dailyTask.create({
      data: { title: 'Later', weeklyGoalId: goal.id, date: new Date('2026-07-30') },
    })
    const earlier = await prisma.dailyTask.create({
      data: { title: 'Earlier', weeklyGoalId: goal.id, date: new Date('2026-07-28') },
    })

    const [result] = await listWeeklyGoalsByObjective(objective.id)

    expect(result.dailyTasks.map((t) => t.id)).toEqual([earlier.id, later.id])
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

  it(
    'round-trips weekOf through create -> edit-page default value -> update without shifting ' +
      'a week (regression test for the toISOString UTC round-trip bug)',
    async () => {
      // Force a positive UTC-offset zone: this is the direction that exposes a mismatch
      // between a local-based write (`parseISO`) and a UTC-based read (`toISOString`) — the
      // bug the `format`-based fix removes. Forced explicitly (rather than relying on the
      // machine's own TZ) so this test is meaningful regardless of what timezone it runs in.
      const originalTz = process.env.TZ
      process.env.TZ = 'Europe/Berlin'
      try {
        const objective = await makeObjective()

        await createWeeklyGoal(objective.id, formData({ title: 'Roundtrip', weekOf: '2026-07-27' }))
        const created = (await prisma.weeklyGoal.findMany())[0]
        expect(created.weekStart.getDate()).toBe(27)

        // This is exactly what the edit page's `defaultValues` computation does.
        const weekOfDefault = format(created.weekStart, 'yyyy-MM-dd')
        expect(weekOfDefault).toBe('2026-07-27')

        // Save without changing anything, as if the user just opened and re-submitted the form.
        await updateWeeklyGoal(created.id, formData({ title: 'Roundtrip', weekOf: weekOfDefault }))

        const updated = await prisma.weeklyGoal.findUnique({ where: { id: created.id } })
        expect(format(updated!.weekStart, 'yyyy-MM-dd')).toBe('2026-07-27')
        expect(updated!.weekEnd.getDate()).toBe(2) // Aug 2 — same week, unshifted
      } finally {
        process.env.TZ = originalTz
      }
    },
  )

  it('offers nothing when there is no earlier week at all', async () => {
    const objective = await makeObjective()
    await prisma.weeklyGoal.create({
      data: { title: 'Atual', objectiveId: objective.id, ...getWeekBounds(new Date()) },
    })

    expect(await getMissingGoalsPreview()).toBeNull()
  })

  it('offers nothing when every source goal already has a counterpart this week', async () => {
    const objective = await makeObjective()
    const currentWeek = getWeekBounds(new Date())
    const lastWeek = getWeekBounds(addWeeks(currentWeek.weekStart, -1))
    await prisma.weeklyGoal.create({
      data: { title: 'Praticar inglês', objectiveId: objective.id, ...lastWeek },
    })
    await prisma.weeklyGoal.create({
      data: { title: 'Praticar inglês', objectiveId: objective.id, ...currentWeek },
    })

    expect(await getMissingGoalsPreview()).toBeNull()
  })

  it('offers the most recent earlier week, skipping empty weeks in between', async () => {
    const objective = await makeObjective()
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const oneWeekAgo = getWeekBounds(addWeeks(currentWeekStart, -1))
    const fourWeeksAgo = getWeekBounds(addWeeks(currentWeekStart, -4))

    await prisma.weeklyGoal.create({
      data: { title: 'Antiga', objectiveId: objective.id, ...fourWeeksAgo },
    })
    await prisma.weeklyGoal.create({
      data: { title: 'Recente', objectiveId: objective.id, ...oneWeekAgo },
    })

    const preview = await getMissingGoalsPreview()

    expect(preview?.sourceWeekStart).toEqual(oneWeekAgo.weekStart)
    expect(preview?.goals.map((g) => g.title)).toEqual(['Recente'])
  })

  it('offers only the goals without a counterpart, ordered by title', async () => {
    const objective = await makeObjective()
    const currentWeek = getWeekBounds(new Date())
    const lastWeek = getWeekBounds(addWeeks(currentWeek.weekStart, -1))

    const zebra = await prisma.weeklyGoal.create({
      data: { title: 'Zebra', objectiveId: objective.id, ...lastWeek },
    })
    const alfa = await prisma.weeklyGoal.create({
      data: { title: 'Alfa', objectiveId: objective.id, ...lastWeek },
    })
    await prisma.weeklyGoal.create({
      data: { title: 'Meio', objectiveId: objective.id, ...lastWeek },
    })
    // Already brought over by hand — must not be offered again.
    await prisma.weeklyGoal.create({
      data: { title: 'Meio', objectiveId: objective.id, ...currentWeek },
    })
    await prisma.dailyTask.createMany({
      data: [
        { title: 'T1', weeklyGoalId: alfa.id, date: lastWeek.weekStart },
        { title: 'T2', weeklyGoalId: alfa.id, date: lastWeek.weekStart },
        { title: 'T3', weeklyGoalId: zebra.id, date: lastWeek.weekStart },
      ],
    })

    const preview = await getMissingGoalsPreview()

    // Alphabetical, not insertion order: without an explicit `orderBy` Postgres
    // returns rows in an unspecified order and the list would reshuffle between
    // renders of identical data.
    expect(preview?.goals).toEqual([
      { id: alfa.id, title: 'Alfa', taskCount: 2 },
      { id: zebra.id, title: 'Zebra', taskCount: 1 },
    ])
  })

  it('treats a same-titled goal under a different objective as still missing', async () => {
    const first = await makeObjective()
    const second = await prisma.objective.create({
      data: { title: 'Outro', startDate: new Date() },
    })
    const currentWeek = getWeekBounds(new Date())
    const lastWeek = getWeekBounds(addWeeks(currentWeek.weekStart, -1))

    await prisma.weeklyGoal.create({
      data: { title: 'Revisar orçamento', objectiveId: first.id, ...lastWeek },
    })
    // Same title, different objective — not a counterpart.
    await prisma.weeklyGoal.create({
      data: { title: 'Revisar orçamento', objectiveId: second.id, ...currentWeek },
    })

    const preview = await getMissingGoalsPreview()

    expect(preview?.goals.map((g) => g.title)).toEqual(['Revisar orçamento'])
  })
})
