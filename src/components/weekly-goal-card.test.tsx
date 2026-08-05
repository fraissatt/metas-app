import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format } from 'date-fns'
import { WeeklyGoalCard } from '@/components/weekly-goal-card'
import { getWeekBounds } from '@/lib/dates'
import type { WeeklyGoalWithTasks } from '@/lib/actions/weeklyGoals'

const DAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

const baseGoal: WeeklyGoalWithTasks = {
  id: 'goal-1',
  title: 'Cobrir fluxo de metas',
  objectiveId: 'obj-1',
  weekStart: new Date('2026-07-27T00:00:00'), // Monday
  weekEnd: new Date('2026-08-02T00:00:00'),
  status: 'ACTIVE',
  dailyTasks: [
    {
      id: 'task-1',
      title: 'Testar toggle',
      weeklyGoalId: 'goal-1',
      date: new Date('2026-07-28T00:00:00'),
      completed: true,
      completedAt: new Date('2026-07-28T00:00:00'),
    },
    {
      id: 'task-2',
      title: 'Testar criação',
      weeklyGoalId: 'goal-1',
      date: new Date('2026-07-29T00:00:00'),
      completed: false,
      completedAt: null,
    },
  ],
}

describe('WeeklyGoalCard', () => {
  it("shows progress computed from the goal's daily tasks", () => {
    render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByText('1/2 tarefas (50%)')).toBeInTheDocument()
  })

  it('renders one day toggle per day of the week, labeled with the real day-of-month number', () => {
    render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getAllByRole('checkbox')).toHaveLength(7)
    expect(screen.getByRole('checkbox', { name: 'SEG 27' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'DOM 2' })).toBeInTheDocument()
  })

  it("pre-checks today's toggle when the goal's week contains today", () => {
    const { weekStart, weekEnd } = getWeekBounds(new Date())
    const goal: WeeklyGoalWithTasks = { ...baseGoal, weekStart, weekEnd, dailyTasks: [] }
    const today = new Date()
    const todayIndex = (today.getDay() + 6) % 7 // Mon=0 ... Sun=6
    const label = `${DAY_LABELS[todayIndex]} ${format(today, 'd')}`

    render(
      <WeeklyGoalCard goal={goal} expanded={false} onToggleExpand={vi.fn()} onCreateTasks={vi.fn()} onDelete={vi.fn()} />,
    )

    expect(screen.getByRole('checkbox', { name: label })).toBeChecked()
  })

  it('submits the title and every checked day when creating a task', async () => {
    const onCreateTasks = vi.fn().mockResolvedValue(undefined)
    render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={onCreateTasks}
        onDelete={vi.fn()}
      />,
    )

    await userEvent.type(screen.getByPlaceholderText('Nova tarefa'), 'Alongamento')
    await userEvent.click(screen.getByRole('checkbox', { name: 'TER 28' }))
    await userEvent.click(screen.getByRole('button', { name: /^criar$/i }))

    const submitted = onCreateTasks.mock.calls[0][0] as FormData
    expect(submitted.get('title')).toBe('Alongamento')
    expect(submitted.getAll('dates')).toEqual(['2026-07-28'])
  })

  it('toggles the expanded detail view via onToggleExpand and shows the read-only task list when expanded', () => {
    const onToggleExpand = vi.fn()
    const { rerender } = render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={onToggleExpand}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.queryByText(/Testar criação/)).not.toBeInTheDocument()

    rerender(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded
        onToggleExpand={onToggleExpand}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByText(/Testar criação/)).toBeInTheDocument()
    expect(screen.getByText(/Testar toggle/)).toBeInTheDocument()
  })

  it('links the title to the dedicated weekly goal page', () => {
    render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByRole('link', { name: 'Cobrir fluxo de metas' })).toHaveAttribute(
      'href',
      '/objectives/obj-1/weeks/goal-1',
    )
  })

  it('links Editar to the dedicated edit page', () => {
    render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /editar/i })).toHaveAttribute(
      'href',
      '/objectives/obj-1/weeks/goal-1/edit',
    )
  })
})
