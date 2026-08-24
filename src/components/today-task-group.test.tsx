import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TodayTaskGroup } from '@/components/today-task-group'
import type { TaskGroup } from '@/lib/tasks'

const objective = {
  id: 'obj-1',
  title: 'Organizar finanças',
  description: null,
  startDate: new Date(2026, 6, 1),
  targetDate: null,
  status: 'ACTIVE' as const,
  createdAt: new Date(2026, 6, 1),
}

const weeklyGoal = {
  id: 'goal-1',
  title: 'Revisar orçamento',
  objectiveId: 'obj-1',
  weekStart: new Date(2026, 7, 17),
  weekEnd: new Date(2026, 7, 23),
  status: 'ACTIVE' as const,
  objective,
}

function group(completions: boolean[]): TaskGroup {
  return {
    weeklyGoal,
    tasks: completions.map((completed, index) => ({
      id: `task-${index}`,
      title: `Tarefa ${index}`,
      weeklyGoalId: 'goal-1',
      date: new Date(2026, 7, 19),
      completed,
      completedAt: completed ? new Date(2026, 7, 19) : null,
      weeklyGoal,
    })),
  }
}

describe('TodayTaskGroup', () => {
  it("shows a check once every one of today's tasks is done", () => {
    render(<TodayTaskGroup group={group([true, true])} onToggleTask={vi.fn()} />)

    expect(screen.getByText('✓ feito')).toBeInTheDocument()
    expect(screen.queryByText('2/2')).not.toBeInTheDocument()
  })

  it('still shows the count while any task is outstanding', () => {
    render(<TodayTaskGroup group={group([true, false])} onToggleTask={vi.fn()} />)

    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.queryByText('✓ feito')).not.toBeInTheDocument()
  })
})
