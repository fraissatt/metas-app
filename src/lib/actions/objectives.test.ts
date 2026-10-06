import { describe, expect, it } from 'vitest'
import { addWeeks, format, parseISO } from 'date-fns'
import { prisma } from '@/lib/db'
import { getWeekBounds } from '@/lib/dates'
import {
  completeObjective,
  countObjectives,
  createObjective,
  deleteObjective,
  getObjective,
  getObjectiveStats,
  listObjectives,
  listObjectivesWithStats,
  reopenObjective,
  updateObjective,
} from '@/lib/actions/objectives'
import { NOT_FOUND } from '@/lib/owned'
import { TEST_USER_ID, createTestUser } from '@/test/session-mock'

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

  it('sets the current user as owner of the created objective', async () => {
    await createObjective(formData({ title: 'Aprender React', startDate: '2026-01-01' }))

    const created = await prisma.objective.findFirstOrThrow()
    expect(created.userId).toBe(TEST_USER_ID)
  })

  it('lists objectives newest first', async () => {
    const first = await prisma.objective.create({ data: { userId: TEST_USER_ID, title: 'A', startDate: new Date() } })
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = await prisma.objective.create({ data: { userId: TEST_USER_ID, title: 'B', startDate: new Date() } })

    const result = await listObjectives()

    expect(result.map((o) => o.id)).toEqual([second.id, first.id])
  })

  it('gets a single objective by id', async () => {
    const created = await prisma.objective.create({ data: { userId: TEST_USER_ID, title: 'A', startDate: new Date() } })

    const found = await getObjective(created.id)

    expect(found?.title).toBe('A')
  })

  it('updates an objective', async () => {
    const created = await prisma.objective.create({ data: { userId: TEST_USER_ID, title: 'A', startDate: new Date() } })

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
    const created = await prisma.objective.create({ data: { userId: TEST_USER_ID, title: 'A', startDate: new Date() } })

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

  it('counts objectives without loading their rows', async () => {
    expect(await countObjectives()).toBe(0)

    await prisma.objective.createMany({
      data: [
        { userId: TEST_USER_ID, title: 'Primeiro', startDate: new Date() },
        { userId: TEST_USER_ID, title: 'Segundo', startDate: new Date() },
      ],
    })

    expect(await countObjectives()).toBe(2)
  })

  it('reports zeros for an objective with no weekly goals', async () => {
    const objective = await prisma.objective.create({
      data: { userId: TEST_USER_ID, title: 'Academia', startDate: new Date() },
    })

    const stats = await getObjectiveStats(objective.id)

    expect(stats.weeksFulfilled).toBe(0)
    expect(stats.tasksCompleted).toBe(0)
    expect(stats.recentWeeks).toEqual([])
  })

  it('counts fulfilled weeks and completed tasks across weeks', async () => {
    const objective = await prisma.objective.create({
      data: { userId: TEST_USER_ID, title: 'Academia', startDate: parseISO('2026-07-06') },
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
      data: { userId: TEST_USER_ID, title: 'Academia', startDate: addWeeks(new Date(), -5) },
    })

    expect((await getObjectiveStats(objective.id)).weeksSinceStart).toBe(5)
  })

  it('freezes weeksSinceStart at completion instead of letting it keep growing', async () => {
    const startDate = addWeeks(new Date(), -10)
    const completedAt = addWeeks(startDate, 4)
    const objective = await prisma.objective.create({
      data: { userId: TEST_USER_ID, title: 'Academia', startDate, status: 'COMPLETED', completedAt },
    })

    expect((await getObjectiveStats(objective.id)).weeksSinceStart).toBe(4)
  })

  it('returns every week when there are fewer than 26, and the most recent 26 when there are more', async () => {
    const objective = await prisma.objective.create({
      data: { userId: TEST_USER_ID, title: 'Academia', startDate: parseISO('2026-01-05') },
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

  it('completes an objective, recording when', async () => {
    const objective = await prisma.objective.create({
      data: { userId: TEST_USER_ID, title: 'Correr 5km', startDate: new Date() },
    })

    await completeObjective(objective.id)

    const completed = await prisma.objective.findUniqueOrThrow({ where: { id: objective.id } })
    expect(completed.status).toBe('COMPLETED')
    expect(completed.completedAt).toBeInstanceOf(Date)
  })

  it('reopens a completed objective, clearing the completion date', async () => {
    const objective = await prisma.objective.create({
      data: {
        userId: TEST_USER_ID,
        title: 'Correr 5km',
        startDate: new Date(),
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })

    await reopenObjective(objective.id)

    const reopened = await prisma.objective.findUniqueOrThrow({ where: { id: objective.id } })
    expect(reopened.status).toBe('ACTIVE')
    expect(reopened.completedAt).toBeNull()
  })

  it('leaves an already-completed objective completed', async () => {
    // Idempotent by construction — no guard needed, and none is used.
    const objective = await prisma.objective.create({
      data: { userId: TEST_USER_ID, title: 'Correr 5km', startDate: new Date() },
    })

    await completeObjective(objective.id)
    await completeObjective(objective.id)

    const completed = await prisma.objective.findUniqueOrThrow({ where: { id: objective.id } })
    expect(completed.status).toBe('COMPLETED')
  })

  it('splits objectives into active and completed, each carrying its stats', async () => {
    const active = await prisma.objective.create({
      data: { userId: TEST_USER_ID, title: 'Em andamento', startDate: new Date() },
    })
    const done = await prisma.objective.create({
      data: {
        userId: TEST_USER_ID,
        title: 'Terminado',
        startDate: new Date(),
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })

    const { active: activeList, completed } = await listObjectivesWithStats()

    expect(activeList.map((o) => o.id)).toEqual([active.id])
    expect(completed.map((o) => o.id)).toEqual([done.id])
    expect(activeList[0].stats.weeksFulfilled).toBe(0)
  })

  it('orders completed objectives by most recently completed', async () => {
    const older = await prisma.objective.create({
      data: {
        userId: TEST_USER_ID,
        title: 'Antigo',
        startDate: new Date(),
        status: 'COMPLETED',
        completedAt: parseISO('2026-07-01'),
      },
    })
    const newer = await prisma.objective.create({
      data: {
        userId: TEST_USER_ID,
        title: 'Recente',
        startDate: new Date(),
        status: 'COMPLETED',
        completedAt: parseISO('2026-08-01'),
      },
    })

    const { completed } = await listObjectivesWithStats()

    expect(completed.map((o) => o.id)).toEqual([newer.id, older.id])
  })
})

describe('isolation between users', () => {
  async function otherObjective() {
    await createTestUser('other')
    return prisma.objective.create({ data: { title: 'Alheio', startDate: new Date(), userId: 'other' } })
  }

  it("lists, counts and searches only the current user's objectives", async () => {
    const foreign = await otherObjective()
    await prisma.objective.create({ data: { title: 'Meu', startDate: new Date(), userId: TEST_USER_ID } })
    expect((await listObjectives()).map((o) => o.title)).toEqual(['Meu'])
    expect(await countObjectives()).toBe(1)
    const { active, completed } = await listObjectivesWithStats()
    expect([...active, ...completed].map((o) => o.id)).not.toContain(foreign.id)
  })

  it("returns null for another user's objective", async () => {
    const foreign = await otherObjective()
    expect(await getObjective(foreign.id)).toBeNull()
  })

  it("cannot update, delete, complete, reopen or read stats of another user's objective", async () => {
    const foreign = await otherObjective()
    const form = new FormData()
    form.set('title', 'Hack')
    form.set('startDate', '2026-10-01')
    await expect(updateObjective(foreign.id, form)).rejects.toThrow(NOT_FOUND)
    await expect(deleteObjective(foreign.id)).rejects.toThrow(NOT_FOUND)
    await expect(completeObjective(foreign.id)).rejects.toThrow(NOT_FOUND)
    await expect(reopenObjective(foreign.id)).rejects.toThrow(NOT_FOUND)
    await expect(getObjectiveStats(foreign.id)).rejects.toThrow(NOT_FOUND)
    const after = await prisma.objective.findUniqueOrThrow({ where: { id: foreign.id } })
    expect(after.title).toBe('Alheio')
    expect(after.status).toBe('ACTIVE')
  })
})
