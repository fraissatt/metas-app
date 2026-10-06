import { describe, expect, it } from 'vitest'
import { groupTasksByWeeklyGoal, type TaskWithGoal } from '@/lib/tasks'

const objective = {
  id: 'obj-1',
  title: 'Organizar finanças',
  description: null,
  startDate: new Date('2026-07-01'),
  targetDate: null,
  status: 'ACTIVE' as const,
  createdAt: new Date('2026-07-01'),
  userId: 'test-user',
}

const otherObjective = { ...objective, id: 'obj-2', title: 'Aprender inglês' }

const goalA = {
  id: 'goal-a',
  title: 'Revisar orçamento mensal',
  objectiveId: 'obj-1',
  weekStart: new Date('2026-08-03'),
  weekEnd: new Date('2026-08-09'),
  status: 'ACTIVE' as const,
  recurring: false,
  objective,
}

const goalB = {
  id: 'goal-b',
  title: 'Praticar conversação',
  objectiveId: 'obj-2',
  weekStart: new Date('2026-08-03'),
  weekEnd: new Date('2026-08-09'),
  status: 'ACTIVE' as const,
  recurring: false,
  objective: otherObjective,
}

function makeTask(overrides: Partial<TaskWithGoal> & { id: string; weeklyGoal: TaskWithGoal['weeklyGoal'] }): TaskWithGoal {
  return {
    title: 'Tarefa',
    weeklyGoalId: overrides.weeklyGoal.id,
    date: new Date('2026-08-05'),
    completed: false,
    completedAt: null,
    ...overrides,
  }
}

describe('groupTasksByWeeklyGoal', () => {
  it('returns an empty array for no tasks', () => {
    expect(groupTasksByWeeklyGoal([])).toEqual([])
  })

  it('puts tasks that share a weekly goal into one group', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Categorizar gastos', weeklyGoal: goalA }),
      makeTask({ id: 't2', title: 'Cancelar assinaturas', weeklyGoal: goalA }),
    ]

    const groups = groupTasksByWeeklyGoal(tasks)

    expect(groups).toHaveLength(1)
    expect(groups[0].weeklyGoal.id).toBe('goal-a')
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('orders groups by first appearance of their weekly goal', () => {
    const tasks = [
      makeTask({ id: 't1', weeklyGoal: goalB }),
      makeTask({ id: 't2', weeklyGoal: goalA }),
      makeTask({ id: 't3', weeklyGoal: goalB }),
    ]

    const groups = groupTasksByWeeklyGoal(tasks)

    expect(groups.map((g) => g.weeklyGoal.id)).toEqual(['goal-b', 'goal-a'])
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['t1', 't3'])
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['t2'])
  })
})
