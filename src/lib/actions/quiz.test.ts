import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { format } from 'date-fns'
import { prisma } from '@/lib/db'
import { TEMPLATES } from '@/lib/quiz/build-plan'
import { createPlanFromQuiz } from '@/lib/actions/quiz'
import { TEST_USER_ID } from '@/test/session-mock'
import { formatDayKey } from '@/lib/dates'

const redirect = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ redirect }))

const ymd = (d: Date) => formatDayKey(d)
const SID = 'session-0001'
const answers = {
  area: 'saude',
  foco: 'correr',
  prazo: 3,
  dias: ['seg', 'qua', 'sab'],
  obstaculo: 'constancia',
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-01T15:00:00-03:00'))
  redirect.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createPlanFromQuiz', () => {
  it('creates objective, weekly goals, tasks and the plan_created event, then redirects', async () => {
    await createPlanFromQuiz({ sessionId: SID, answers })

    const objectives = await prisma.objective.findMany()
    expect(objectives).toHaveLength(1)
    expect(objectives[0].title).toBe(TEMPLATES.correr.objective)
    expect(objectives[0].userId).toBe(TEST_USER_ID)
    expect(ymd(objectives[0].startDate)).toBe('2026-10-01')
    expect(ymd(objectives[0].targetDate!)).toBe('2027-01-01')

    const goals = await prisma.weeklyGoal.findMany({ orderBy: { weekStart: 'asc' } })
    expect(goals.map((g) => g.recurring)).toEqual([false, true])
    expect(goals.every((g) => g.objectiveId === objectives[0].id)).toBe(true)

    const tasks = await prisma.dailyTask.findMany({ orderBy: { date: 'asc' } })
    expect(tasks.map((t) => ymd(t.date))).toEqual(['2026-10-03', '2026-10-05', '2026-10-07', '2026-10-10'])
    expect(tasks.every((t) => !t.completed)).toBe(true)

    const events = await prisma.funnelEvent.findMany()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ sessionId: SID, type: 'plan_created' })

    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('redirects to the objective when the plan has no task in the current week', async () => {
    vi.setSystemTime(new Date('2026-10-08T15:00:00-03:00')) // Thursday: seg and ter have passed
    await createPlanFromQuiz({ sessionId: SID, answers: { ...answers, dias: ['seg', 'ter'] } })

    const [objective] = await prisma.objective.findMany()
    const goals = await prisma.weeklyGoal.findMany()
    expect(goals.map((g) => g.recurring)).toEqual([true])
    expect(ymd(goals[0].weekStart)).toBe('2026-10-12')
    expect(redirect).toHaveBeenCalledWith(`/objectives/${objective.id}`)
  })

  it('still creates the plan but skips the event when the sessionId is invalid', async () => {
    await createPlanFromQuiz({ sessionId: 'x', answers })
    expect(await prisma.objective.count()).toBe(1)
    expect(await prisma.funnelEvent.count()).toBe(0)
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('throws and writes nothing for invalid answers', async () => {
    await expect(
      createPlanFromQuiz({ sessionId: SID, answers: { ...answers, dias: [] } }),
    ).rejects.toThrow('Não foi possível criar o plano')
    expect(await prisma.objective.count()).toBe(0)
    expect(await prisma.weeklyGoal.count()).toBe(0)
    expect(await prisma.dailyTask.count()).toBe(0)
    expect(await prisma.funnelEvent.count()).toBe(0)
    expect(redirect).not.toHaveBeenCalled()
  })
})
