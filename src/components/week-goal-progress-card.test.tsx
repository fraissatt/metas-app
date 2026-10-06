import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeekGoalProgressCard } from '@/components/week-goal-progress-card'

const objective = {
  id: 'obj-1',
  title: 'Aprender Next.js 16',
  description: null,
  startDate: new Date('2026-07-01'),
  targetDate: null,
  status: 'ACTIVE' as const,
  completedAt: null,
  createdAt: new Date('2026-07-01'),
  userId: 'test-user',
}

const weeklyGoal = {
  id: 'goal-1',
  title: 'Ler documentação do App Router',
  objectiveId: 'obj-1',
  weekStart: new Date('2026-07-27'), // Monday
  weekEnd: new Date('2026-08-02'),
  status: 'ACTIVE' as const,
  recurring: false,
  objective,
}

function task(overrides: { id: string; date: Date; completed: boolean }) {
  return {
    title: 'Tarefa',
    weeklyGoalId: 'goal-1',
    completedAt: null,
    ...overrides,
  }
}

describe('WeekGoalProgressCard', () => {
  it('links the title to the weekly goal page and the objective title to the objective page', () => {
    render(<WeekGoalProgressCard goal={{ ...weeklyGoal, dailyTasks: [] }} />)

    expect(screen.getByRole('link', { name: 'Ler documentação do App Router' })).toHaveAttribute(
      'href',
      '/objectives/obj-1/weeks/goal-1',
    )
    expect(screen.getByRole('link', { name: 'Aprender Next.js 16' })).toHaveAttribute('href', '/objectives/obj-1')
  })

  it('shows completed/total tasks for the week', () => {
    const dailyTasks = [
      task({ id: 'task-1', date: new Date('2026-07-27'), completed: true }),
      task({ id: 'task-2', date: new Date('2026-07-28'), completed: false }),
      task({ id: 'task-3', date: new Date('2026-07-29'), completed: true }),
    ]

    render(<WeekGoalProgressCard goal={{ ...weeklyGoal, dailyTasks }} />)

    expect(screen.getByText('2/3 tarefas')).toBeInTheDocument()
  })

  it('renders a ring whose fill matches the completion percentage', () => {
    const dailyTasks = [
      task({ id: 'task-1', date: new Date('2026-07-27'), completed: true }),
      task({ id: 'task-2', date: new Date('2026-07-28'), completed: false }),
    ]

    render(<WeekGoalProgressCard goal={{ ...weeklyGoal, dailyTasks }} />)

    const ring = screen.getByTestId('progress-ring')
    const circumference = 2 * Math.PI * 16
    const expectedOffset = circumference - 0.5 * circumference // 50%

    expect(Number(ring.getAttribute('stroke-dashoffset'))).toBeCloseTo(expectedOffset, 5)
  })

  it("renders one sparkline bar per day of the week, with a hover tooltip showing that day's count", () => {
    const dailyTasks = [
      task({ id: 'task-1', date: new Date('2026-07-27'), completed: true }), // Monday
      task({ id: 'task-2', date: new Date('2026-07-28'), completed: false }), // Tuesday
    ]

    render(<WeekGoalProgressCard goal={{ ...weeklyGoal, dailyTasks }} />)

    expect(screen.getByTitle('SEG: 1/1 tarefas')).toBeInTheDocument()
    expect(screen.getByTitle('TER: 0/1 tarefas')).toBeInTheDocument()
    expect(screen.getByTitle('QUA: 0/0 tarefas')).toBeInTheDocument()
  })

  it('shows 0/0 tarefas and does not crash when the goal has no tasks yet', () => {
    render(<WeekGoalProgressCard goal={{ ...weeklyGoal, dailyTasks: [] }} />)

    expect(screen.getByText('0/0 tarefas')).toBeInTheDocument()
  })

  it('marks the card as fulfilled when every task for the week is complete', () => {
    const dailyTasks = [
      task({ id: 'task-1', date: new Date('2026-07-27'), completed: true }),
      task({ id: 'task-2', date: new Date('2026-07-28'), completed: true }),
    ]

    render(<WeekGoalProgressCard goal={{ ...weeklyGoal, dailyTasks }} />)

    expect(screen.getByText('✓ concluída')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Meta da semana fechada')
    expect(screen.queryByText('2/2 tarefas')).not.toBeInTheDocument()
  })

  it('flags a fulfilled week so it can glow', () => {
    const dailyTasks = [
      task({ id: 'task-1', date: new Date('2026-07-27'), completed: true }),
      task({ id: 'task-2', date: new Date('2026-07-28'), completed: true }),
    ]
    const { container } = render(<WeekGoalProgressCard goal={{ ...weeklyGoal, dailyTasks }} />)

    expect(container.firstElementChild).toHaveAttribute('data-fulfilled', 'true')
  })

  it('does not celebrate a partially complete week', () => {
    const dailyTasks = [
      task({ id: 'task-1', date: new Date('2026-07-27'), completed: true }),
      task({ id: 'task-2', date: new Date('2026-07-28'), completed: false }),
    ]

    render(<WeekGoalProgressCard goal={{ ...weeklyGoal, dailyTasks }} />)

    expect(screen.queryByText('✓ concluída')).not.toBeInTheDocument()
    expect(screen.getByText('1/2 tarefas')).toBeInTheDocument()
  })

  it('does not celebrate a goal that has no tasks at all', () => {
    render(<WeekGoalProgressCard goal={{ ...weeklyGoal, dailyTasks: [] }} />)

    expect(screen.queryByText('✓ concluída')).not.toBeInTheDocument()
    expect(screen.getByText('0/0 tarefas')).toBeInTheDocument()
  })
})
