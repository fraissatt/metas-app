import { describe, expect, it, vi } from 'vitest'
import { format, parseISO } from 'date-fns'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import {
  createDailyTask,
  deleteDailyTask,
  getDailyTask,
  listDailyTasksByDate,
  listDailyTasksByWeeklyGoal,
  toggleDailyTask,
  updateDailyTask,
} from '@/lib/actions/dailyTasks'
import { getWeekBounds } from '@/lib/dates'

function formData(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(fields)) fd.set(key, value)
  return fd
}

async function makeWeeklyGoal() {
  const objective = await prisma.objective.create({ data: { title: 'Obj', startDate: new Date() } })
  const bounds = getWeekBounds(new Date('2026-07-29'))
  return prisma.weeklyGoal.create({ data: { title: 'Goal', objectiveId: objective.id, ...bounds } })
}

describe('daily task actions', () => {
  it('creates a daily task from form data', async () => {
    const goal = await makeWeeklyGoal()

    await createDailyTask(goal.id, formData({ title: 'Correr 5km', date: '2026-07-29' }))

    const tasks = await prisma.dailyTask.findMany()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('Correr 5km')
    expect(tasks[0].completed).toBe(false)
    expect(revalidatePath).toHaveBeenCalledWith(`/objectives/${goal.objectiveId}/weeks/${goal.id}`)
    // The Today view on `/` also renders daily tasks by date (I2): a task created for
    // today must revalidate there too, not just on the weekly-goal detail page.
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('rejects an empty title', async () => {
    const goal = await makeWeeklyGoal()

    await expect(
      createDailyTask(goal.id, formData({ title: '  ', date: '2026-07-29' })),
    ).rejects.toThrow()
    expect(await prisma.dailyTask.findMany()).toHaveLength(0)
  })

  it('rejects an unparseable date', async () => {
    const goal = await makeWeeklyGoal()

    await expect(
      createDailyTask(goal.id, formData({ title: 'Correr 5km', date: 'not-a-date' })),
    ).rejects.toThrow()
    expect(await prisma.dailyTask.findMany()).toHaveLength(0)
  })

  it('lists tasks for a weekly goal ordered by date', async () => {
    const goal = await makeWeeklyGoal()
    const later = await prisma.dailyTask.create({
      data: { title: 'Later', weeklyGoalId: goal.id, date: new Date('2026-07-30') },
    })
    const earlier = await prisma.dailyTask.create({
      data: { title: 'Earlier', weeklyGoalId: goal.id, date: new Date('2026-07-28') },
    })

    const result = await listDailyTasksByWeeklyGoal(goal.id)

    expect(result.map((t) => t.id)).toEqual([earlier.id, later.id])
  })

  it('lists tasks for a specific date across weekly goals, with objective included', async () => {
    const goal = await makeWeeklyGoal()
    const match = await prisma.dailyTask.create({
      data: { title: 'Today task', weeklyGoalId: goal.id, date: parseISO('2026-07-29') },
    })
    await prisma.dailyTask.create({
      data: { title: 'Other day', weeklyGoalId: goal.id, date: parseISO('2026-07-30') },
    })

    const result = await listDailyTasksByDate(parseISO('2026-07-29'))

    expect(result.map((t) => t.id)).toEqual([match.id])
    expect(result[0].weeklyGoal.objective.title).toBe('Obj')
  })

  it('gets and updates a task without touching its completed state', async () => {
    const goal = await makeWeeklyGoal()
    const task = await prisma.dailyTask.create({
      data: { title: 'Original', weeklyGoalId: goal.id, date: new Date('2026-07-29'), completed: true },
    })

    expect((await getDailyTask(task.id))?.title).toBe('Original')

    await updateDailyTask(task.id, formData({ title: 'Renamed', date: '2026-07-30' }))

    const updated = await prisma.dailyTask.findUnique({ where: { id: task.id } })
    expect(updated?.title).toBe('Renamed')
    expect(updated?.date.getDate()).toBe(30)
    expect(updated?.completed).toBe(true)
    expect(revalidatePath).toHaveBeenCalledWith(`/objectives/${goal.objectiveId}/weeks/${goal.id}`)
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('rejects an empty title on update', async () => {
    const goal = await makeWeeklyGoal()
    const task = await prisma.dailyTask.create({
      data: { title: 'Original', weeklyGoalId: goal.id, date: new Date('2026-07-29') },
    })

    await expect(updateDailyTask(task.id, formData({ title: '  ', date: '2026-07-29' }))).rejects.toThrow()
    expect((await prisma.dailyTask.findUnique({ where: { id: task.id } }))?.title).toBe('Original')
  })

  it('toggles completion and stamps completedAt', async () => {
    const goal = await makeWeeklyGoal()
    const task = await prisma.dailyTask.create({
      data: { title: 'Task', weeklyGoalId: goal.id, date: new Date('2026-07-29') },
    })

    await toggleDailyTask(task.id)
    const completed = await prisma.dailyTask.findUnique({ where: { id: task.id } })
    expect(completed?.completed).toBe(true)
    expect(completed?.completedAt).not.toBeNull()
    expect(revalidatePath).toHaveBeenCalledWith(`/objectives/${goal.objectiveId}/weeks/${goal.id}`)
    expect(revalidatePath).toHaveBeenCalledWith('/')

    vi.mocked(revalidatePath).mockClear()

    await toggleDailyTask(task.id)
    const uncompleted = await prisma.dailyTask.findUnique({ where: { id: task.id } })
    expect(uncompleted?.completed).toBe(false)
    expect(uncompleted?.completedAt).toBeNull()
    expect(revalidatePath).toHaveBeenCalledWith(`/objectives/${goal.objectiveId}/weeks/${goal.id}`)
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('deletes a task', async () => {
    const goal = await makeWeeklyGoal()
    const task = await prisma.dailyTask.create({
      data: { title: 'Task', weeklyGoalId: goal.id, date: new Date('2026-07-29') },
    })

    await deleteDailyTask(task.id)

    expect(await prisma.dailyTask.findUnique({ where: { id: task.id } })).toBeNull()
    expect(revalidatePath).toHaveBeenCalledWith(`/objectives/${goal.objectiveId}/weeks/${goal.id}`)
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it(
    'round-trips date through create -> edit-page default value -> update without shifting a ' +
      'day (regression test for the toISOString UTC round-trip bug)',
    async () => {
      // Force a positive UTC-offset zone: this is the direction that exposes a mismatch
      // between a local-based write (`parseISO`) and a UTC-based read (`toISOString`) — the
      // bug the `format`-based fix removes. Forced explicitly (rather than relying on the
      // machine's own TZ) so this test is meaningful regardless of what timezone it runs in.
      const originalTz = process.env.TZ
      process.env.TZ = 'Europe/Berlin'
      try {
        const goal = await makeWeeklyGoal()

        await createDailyTask(goal.id, formData({ title: 'Roundtrip', date: '2026-07-29' }))
        const created = (await prisma.dailyTask.findMany())[0]

        // This is exactly what the edit page's `defaultValues` computation does.
        const dateDefault = format(created.date, 'yyyy-MM-dd')
        expect(dateDefault).toBe('2026-07-29')

        // Save without changing anything, as if the user just opened and re-submitted the form.
        await updateDailyTask(created.id, formData({ title: 'Roundtrip', date: dateDefault }))

        const updated = await prisma.dailyTask.findUnique({ where: { id: created.id } })
        expect(format(updated!.date, 'yyyy-MM-dd')).toBe('2026-07-29')
      } finally {
        process.env.TZ = originalTz
      }
    },
  )
})
