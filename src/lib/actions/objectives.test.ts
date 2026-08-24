import { describe, expect, it } from 'vitest'
import { addWeeks, format, parseISO } from 'date-fns'
import { prisma } from '@/lib/db'
import { getWeekBounds } from '@/lib/dates'
import {
  createObjective,
  deleteObjective,
  getObjective,
  getObjectiveStats,
  listObjectives,
  updateObjective,
} from '@/lib/actions/objectives'

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) fd.set(key, value)
  return fd
}

describe('objective actions', () => {
  it('creates an objective from form data', async () => {
    await createObjective(formData({ title: 'Aprender React', startDate: '2026-01-01' }))

    const all = await prisma.objective.findMany()
    expect(all).toHaveLength(1)
    expect(all[0].title).toBe('Aprender React')
    expect(all[0].status).toBe('ACTIVE')
  })

  it('lists objectives newest first', async () => {
    const first = await prisma.objective.create({ data: { title: 'A', startDate: new Date() } })
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = await prisma.objective.create({ data: { title: 'B', startDate: new Date() } })

    const result = await listObjectives()

    expect(result.map((o) => o.id)).toEqual([second.id, first.id])
  })

  it('gets a single objective by id', async () => {
    const created = await prisma.objective.create({ data: { title: 'A', startDate: new Date() } })

    const found = await getObjective(created.id)

    expect(found?.title).toBe('A')
  })

  it('updates an objective', async () => {
    const created = await prisma.objective.create({ data: { title: 'A', startDate: new Date() } })

    await updateObjective(created.id, formData({ title: 'B', startDate: '2026-02-01' }))

    const updated = await prisma.objective.findUnique({ where: { id: created.id } })
    expect(updated?.title).toBe('B')
  })

  it('rejects an empty title', async () => {
    await expect(
      createObjective(formData({ title: '   ', startDate: '2026-01-01' })),
    ).rejects.toThrow()
    expect(await prisma.objective.findMany()).toHaveLength(0)
  })

  it('rejects an unparseable startDate', async () => {
    await expect(
      createObjective(formData({ title: 'Aprender React', startDate: 'not-a-date' })),
    ).rejects.toThrow()
    expect(await prisma.objective.findMany()).toHaveLength(0)
  })

  it('deletes an objective', async () => {
    const created = await prisma.objective.create({ data: { title: 'A', startDate: new Date() } })

    await deleteObjective(created.id)

    const found = await prisma.objective.findUnique({ where: { id: created.id } })
    expect(found).toBeNull()
  })

  it(
    'round-trips startDate/targetDate through create -> edit-page default value -> update ' +
      'without shifting (regression test for the toISOString/new Date UTC round-trip bug)',
    async () => {
      // Force a negative UTC-offset zone: this is the direction that exposes a mismatch
      // between a UTC-based write (`new Date(str)`) and a local-based read (`format`) —
      // exactly the inconsistency this fix removes by making both sides `parseISO`/`format`.
      // Forced explicitly (rather than relying on the machine's own TZ) so this test is
      // meaningful regardless of what timezone it happens to run in.
      const originalTz = process.env.TZ
      process.env.TZ = 'America/Sao_Paulo'
      try {
        await createObjective(
          formData({ title: 'Roundtrip', startDate: '2026-01-15', targetDate: '2026-06-30' }),
        )
        const created = (await prisma.objective.findMany())[0]

        // This is exactly what the edit page's `defaultValues` computation does.
        const startDateDefault = format(created.startDate, 'yyyy-MM-dd')
        const targetDateDefault = created.targetDate ? format(created.targetDate, 'yyyy-MM-dd') : ''

        expect(startDateDefault).toBe('2026-01-15')
        expect(targetDateDefault).toBe('2026-06-30')

        // Save without changing anything, as if the user just opened and re-submitted the form.
        await updateObjective(
          created.id,
          formData({ title: 'Roundtrip', startDate: startDateDefault, targetDate: targetDateDefault }),
        )

        const updated = await prisma.objective.findUnique({ where: { id: created.id } })
        expect(format(updated!.startDate, 'yyyy-MM-dd')).toBe('2026-01-15')
        expect(format(updated!.targetDate!, 'yyyy-MM-dd')).toBe('2026-06-30')
      } finally {
        process.env.TZ = originalTz
      }
    },
  )

  it('reports zeros for an objective with no weekly goals', async () => {
    const objective = await prisma.objective.create({
      data: { title: 'Academia', startDate: new Date() },
    })

    const stats = await getObjectiveStats(objective.id)

    expect(stats.weeksFulfilled).toBe(0)
    expect(stats.tasksCompleted).toBe(0)
    expect(stats.recentWeeks).toEqual([])
  })

  it('counts fulfilled weeks and completed tasks across weeks', async () => {
    const objective = await prisma.objective.create({
      data: { title: 'Academia', startDate: parseISO('2026-07-06') },
    })
    const fullWeek = getWeekBounds(parseISO('2026-07-06'))
    const partialWeek = getWeekBounds(parseISO('2026-07-13'))

    const full = await prisma.weeklyGoal.create({
      data: { title: 'Cheia', objectiveId: objective.id, ...fullWeek },
    })
    const partial = await prisma.weeklyGoal.create({
      data: { title: 'Parcial', objectiveId: objective.id, ...partialWeek },
    })
    await prisma.dailyTask.createMany({
      data: [
        { title: 'a', weeklyGoalId: full.id, date: fullWeek.weekStart, completed: true },
        { title: 'b', weeklyGoalId: full.id, date: fullWeek.weekStart, completed: true },
        { title: 'c', weeklyGoalId: partial.id, date: partialWeek.weekStart, completed: true },
        { title: 'd', weeklyGoalId: partial.id, date: partialWeek.weekStart, completed: false },
      ],
    })

    const stats = await getObjectiveStats(objective.id)

    expect(stats.weeksFulfilled).toBe(1)
    expect(stats.tasksCompleted).toBe(3)
    expect(stats.recentWeeks).toHaveLength(2)
  })

  it('measures weeks since the objective started', async () => {
    const objective = await prisma.objective.create({
      data: { title: 'Academia', startDate: addWeeks(new Date(), -5) },
    })

    expect((await getObjectiveStats(objective.id)).weeksSinceStart).toBe(5)
  })

  it('returns every week when there are fewer than 26, and the most recent 26 when there are more', async () => {
    const objective = await prisma.objective.create({
      data: { title: 'Academia', startDate: parseISO('2026-01-05') },
    })
    const firstWeekStart = getWeekBounds(parseISO('2026-01-05')).weekStart

    await prisma.weeklyGoal.createMany({
      data: Array.from({ length: 30 }, (_, i) => ({
        title: `Semana ${i}`,
        objectiveId: objective.id,
        ...getWeekBounds(addWeeks(firstWeekStart, i)),
      })),
    })

    const stats = await getObjectiveStats(objective.id)

    expect(stats.recentWeeks).toHaveLength(26)
    // The window keeps the newest weeks, so the oldest four fall off the front.
    expect(stats.recentWeeks[0].weekStart).toEqual(addWeeks(firstWeekStart, 4))
  })
})
