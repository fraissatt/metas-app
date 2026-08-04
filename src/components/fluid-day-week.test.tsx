import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FluidDayWeek } from '@/components/fluid-day-week'

const objective = {
  id: 'obj-1',
  title: 'Aprender Next.js 16',
  description: null,
  startDate: new Date('2026-07-01'),
  targetDate: null,
  status: 'ACTIVE' as const,
  createdAt: new Date('2026-07-01'),
}

const weeklyGoal = {
  id: 'goal-1',
  title: 'Ler documentação do App Router',
  objectiveId: 'obj-1',
  weekStart: new Date('2026-07-27'),
  weekEnd: new Date('2026-08-02'),
  status: 'ACTIVE' as const,
}

const task = {
  id: 'task-1',
  title: 'Revisar App Router',
  weeklyGoalId: 'goal-1',
  date: new Date('2026-07-30'),
  completed: false,
  completedAt: null,
  weeklyGoal: { ...weeklyGoal, objective },
}

const goal = { ...weeklyGoal, objective, dailyTasks: [] }

describe('FluidDayWeek', () => {
  it('renders collapsed by default', () => {
    render(
      <FluidDayWeek
        tasks={[task]}
        goals={[goal]}
        progress={[{ total: 1, completed: 0, percent: 0 }]}
        onToggleTask={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /ver semana/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('expands the week section when the toggle button is clicked', async () => {
    render(
      <FluidDayWeek
        tasks={[task]}
        goals={[goal]}
        progress={[{ total: 1, completed: 0, percent: 0 }]}
        onToggleTask={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /ver semana/i }))

    expect(screen.getByRole('button', { name: /recolher semana/i })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Ler documentação do App Router')).toBeInTheDocument()
  })

  it('collapses the week section again on a second click', async () => {
    render(
      <FluidDayWeek
        tasks={[task]}
        goals={[goal]}
        progress={[{ total: 1, completed: 0, percent: 0 }]}
        onToggleTask={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /ver semana/i }))
    await userEvent.click(screen.getByRole('button', { name: /recolher semana/i }))

    expect(screen.getByRole('button', { name: /ver semana/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it("renders today's tasks and toggles completion via the injected action", async () => {
    const onToggleTask = vi.fn().mockResolvedValue(undefined)
    render(
      <FluidDayWeek
        tasks={[task]}
        goals={[goal]}
        progress={[{ total: 1, completed: 0, percent: 0 }]}
        onToggleTask={onToggleTask}
      />,
    )

    expect(screen.getByText('Revisar App Router')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox'))

    expect(onToggleTask).toHaveBeenCalledWith('task-1')
  })

  it('shows empty-state copy when there are no tasks or goals', () => {
    render(<FluidDayWeek tasks={[]} goals={[]} progress={[]} onToggleTask={vi.fn()} />)

    expect(screen.getByText('Nenhuma tarefa para hoje.')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma meta semanal para esta semana.')).toBeInTheDocument()
  })

  it('hides the week panel from AT and keyboard while collapsed', async () => {
    const { container } = render(
      <FluidDayWeek
        tasks={[task]}
        goals={[goal]}
        progress={[{ total: 1, completed: 0, percent: 0 }]}
        onToggleTask={vi.fn()}
      />,
    )
    const panel = container.querySelector('#week-section')!

    expect(panel).toHaveAttribute('aria-hidden', 'true')
    expect(panel.firstElementChild).toHaveAttribute('inert')

    await userEvent.click(screen.getByRole('button', { name: /ver semana/i }))

    expect(panel).toHaveAttribute('aria-hidden', 'false')
    expect(panel.firstElementChild).not.toHaveAttribute('inert')
  })
})
