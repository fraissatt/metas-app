import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

const task2 = {
  id: 'task-2',
  title: 'Reler capítulo 3',
  weeklyGoalId: 'goal-1',
  date: new Date('2026-07-30'),
  completed: true,
  completedAt: new Date('2026-07-30'),
  weeklyGoal: { ...weeklyGoal, objective },
}

const goal = { ...weeklyGoal, objective, dailyTasks: [task] }

describe('FluidDayWeek', () => {
  it('groups tasks that share a weekly goal under one header', () => {
    render(<FluidDayWeek tasks={[task, task2]} goals={[]} onToggleTask={vi.fn()} />)

    expect(screen.getAllByText('Ler documentação do App Router')).toHaveLength(1)
    expect(screen.getByText('Revisar App Router')).toBeInTheDocument()
    expect(screen.getByText('Reler capítulo 3')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('renders one group per distinct weekly goal, in first-appearance order', () => {
    const financeTask = {
      id: 'task-finance',
      title: 'Categorizar gastos de julho',
      weeklyGoalId: 'goal-finance',
      date: new Date('2026-08-05'),
      completed: false,
      completedAt: null,
      weeklyGoal: {
        id: 'goal-finance',
        title: 'Revisar orçamento mensal',
        objectiveId: 'obj-finance',
        weekStart: new Date('2026-08-03'),
        weekEnd: new Date('2026-08-09'),
        status: 'ACTIVE' as const,
        objective: {
          id: 'obj-finance',
          title: 'Organizar finanças',
          description: null,
          startDate: new Date('2026-07-01'),
          targetDate: null,
          status: 'ACTIVE' as const,
          createdAt: new Date('2026-07-01'),
        },
      },
    }

    render(<FluidDayWeek tasks={[task, financeTask]} goals={[goal]} onToggleTask={vi.fn()} />)

    const headings = screen.getAllByRole('link', { name: /Ler documentação|Revisar orçamento/ })
    expect(headings.map((el) => el.textContent)).toEqual([
      'Ler documentação do App Router',
      'Revisar orçamento mensal',
    ])
  })

  it('links the group header to the weekly goal page and the objective page', () => {
    render(<FluidDayWeek tasks={[task]} goals={[goal]} onToggleTask={vi.fn()} />)

    expect(screen.getByRole('link', { name: 'Ler documentação do App Router' })).toHaveAttribute(
      'href',
      '/objectives/obj-1/weeks/goal-1',
    )
    expect(screen.getByRole('link', { name: 'Aprender Next.js 16' })).toHaveAttribute('href', '/objectives/obj-1')
  })

  it('renders collapsed by default', () => {
    render(<FluidDayWeek tasks={[task]} goals={[goal]} onToggleTask={vi.fn()} />)

    expect(screen.getByRole('button', { name: /ver semana/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('expands the week section when the toggle button is clicked', async () => {
    const { container } = render(<FluidDayWeek tasks={[task]} goals={[goal]} onToggleTask={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /ver semana/i }))

    expect(screen.getByRole('button', { name: /recolher semana/i })).toHaveAttribute('aria-expanded', 'true')
    expect(
      within(container.querySelector('#week-section')!).getByText('Ler documentação do App Router'),
    ).toBeInTheDocument()
  })

  it('collapses the week section again on a second click', async () => {
    render(<FluidDayWeek tasks={[task]} goals={[goal]} onToggleTask={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /ver semana/i }))
    await userEvent.click(screen.getByRole('button', { name: /recolher semana/i }))

    expect(screen.getByRole('button', { name: /ver semana/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it("renders today's tasks and toggles completion via the injected action", async () => {
    const onToggleTask = vi.fn().mockResolvedValue(undefined)
    render(<FluidDayWeek tasks={[task]} goals={[goal]} onToggleTask={onToggleTask} />)

    expect(screen.getByText('Revisar App Router')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox'))

    expect(onToggleTask).toHaveBeenCalledWith('task-1')
  })

  it('shows empty-state copy when there are no tasks or goals', () => {
    render(<FluidDayWeek tasks={[]} goals={[]} onToggleTask={vi.fn()} />)

    expect(screen.getByText('Nenhuma tarefa para hoje.')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma meta semanal para esta semana.')).toBeInTheDocument()
  })

  it('hides the week panel from AT and keyboard while collapsed', async () => {
    const { container } = render(<FluidDayWeek tasks={[task]} goals={[goal]} onToggleTask={vi.fn()} />)
    const panel = container.querySelector('#week-section')!

    expect(panel).toHaveAttribute('aria-hidden', 'true')
    expect(panel.firstElementChild).toHaveAttribute('inert')

    await userEvent.click(screen.getByRole('button', { name: /ver semana/i }))

    expect(panel).toHaveAttribute('aria-hidden', 'false')
    expect(panel.firstElementChild).not.toHaveAttribute('inert')
  })

  it('shows the week goal progress card with completed/total tasks for the week', async () => {
    render(<FluidDayWeek tasks={[task]} goals={[goal]} onToggleTask={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /ver semana/i }))

    expect(screen.getByText('0/1 tarefas')).toBeInTheDocument()
  })

  it('orders week goals so ones with a task today come first, separated by a divider from the rest', async () => {
    const otherGoal = {
      id: 'goal-2',
      title: 'Meditar',
      objectiveId: 'obj-1',
      weekStart: new Date('2026-07-27'),
      weekEnd: new Date('2026-08-02'),
      status: 'ACTIVE' as const,
      objective,
      dailyTasks: [],
    }

    const { container } = render(<FluidDayWeek tasks={[task]} goals={[otherGoal, goal]} onToggleTask={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /ver semana/i }))

    const panel = within(container.querySelector('#week-section')!)
    const headingOrder = panel
      .getAllByRole('link', { name: /Ler documentação|Meditar/ })
      .map((el) => el.textContent)
    expect(headingOrder).toEqual(['Ler documentação do App Router', 'Meditar'])
    expect(panel.getByText('outras metas da semana')).toBeInTheDocument()
  })

  it('omits the divider when every week goal has a task today', async () => {
    const { container } = render(<FluidDayWeek tasks={[task]} goals={[goal]} onToggleTask={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /ver semana/i }))

    expect(
      within(container.querySelector('#week-section')!).queryByText('outras metas da semana'),
    ).not.toBeInTheDocument()
  })
})
