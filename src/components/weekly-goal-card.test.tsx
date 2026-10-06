import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format } from 'date-fns'
import { WeeklyGoalCard } from '@/components/weekly-goal-card'
import { getWeekBounds } from '@/lib/dates'
import type { WeeklyGoalWithTasks } from '@/lib/actions/weeklyGoals'

async function openNewTaskForm() {
  await userEvent.click(screen.getByRole('button', { name: '+ Nova tarefa' }))
}

const DAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

const baseGoal: WeeklyGoalWithTasks = {
  id: 'goal-1',
  title: 'Cobrir fluxo de metas',
  objectiveId: 'obj-1',
  weekStart: new Date('2026-07-27T00:00:00'), // Monday
  weekEnd: new Date('2026-08-02T00:00:00'),
  status: 'ACTIVE',
  recurring: false,
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
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )

    expect(screen.getByText('1/2 tarefas (50%)')).toBeInTheDocument()
  })

  it('renders one day toggle per day of the week, labeled with the real day-of-month number', async () => {
    render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )

    await openNewTaskForm()
    // The task list has its own checkboxes; count only the day toggles.
    expect(screen.getAllByRole('checkbox', { name: /^(SEG|TER|QUA|QUI|SEX|SÁB|DOM) \d+$/ })).toHaveLength(7)
    expect(screen.getByRole('checkbox', { name: 'SEG 27' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'DOM 2' })).toBeInTheDocument()
  })

  it("pre-checks today's toggle when the goal's week contains today", async () => {
    const { weekStart, weekEnd } = getWeekBounds(new Date())
    const goal: WeeklyGoalWithTasks = { ...baseGoal, weekStart, weekEnd, dailyTasks: [] }
    const today = new Date()
    const todayIndex = (today.getDay() + 6) % 7 // Mon=0 ... Sun=6
    const label = `${DAY_LABELS[todayIndex]} ${format(today, 'd')}`

    render(
      <WeeklyGoalCard goal={goal} expanded={false} onToggleExpand={vi.fn()} onCreateTasks={vi.fn()} onDelete={vi.fn()} onToggleTask={vi.fn()} onUpdateTask={vi.fn()} onDeleteTask={vi.fn()} />,
    )

    await openNewTaskForm()
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
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )

    await openNewTaskForm()
    await userEvent.type(screen.getByLabelText('Nova tarefa'), 'Alongamento')
    await userEvent.click(screen.getByRole('checkbox', { name: 'TER 28' }))
    await userEvent.click(screen.getByRole('button', { name: /^criar$/i }))

    const submitted = onCreateTasks.mock.calls[0][0] as FormData
    expect(submitted.get('title')).toBe('Alongamento')
    expect(submitted.getAll('dates')).toEqual(['2026-07-28'])
  })

  it('submits every checked day when multiple day toggles are checked', async () => {
    const onCreateTasks = vi.fn().mockResolvedValue(undefined)
    render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={onCreateTasks}
        onDelete={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )

    await openNewTaskForm()
    await userEvent.type(screen.getByLabelText('Nova tarefa'), 'Alongamento')
    await userEvent.click(screen.getByRole('checkbox', { name: 'TER 28' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'QUA 29' }))
    await userEvent.click(screen.getByRole('button', { name: /^criar$/i }))

    const submitted = onCreateTasks.mock.calls[0][0] as FormData
    expect(submitted.getAll('dates')).toEqual(
      expect.arrayContaining(['2026-07-28', '2026-07-29']),
    )
    expect(submitted.getAll('dates')).toHaveLength(2)
  })

  it('disables Criar when the goal\'s week does not contain today and no day is checked', async () => {
    const weekStart = new Date('2099-01-05T00:00:00') // Monday, far from "today"
    const weekEnd = new Date('2099-01-11T00:00:00')
    const goal: WeeklyGoalWithTasks = { ...baseGoal, weekStart, weekEnd, dailyTasks: [] }

    render(
      <WeeklyGoalCard goal={goal} expanded={false} onToggleExpand={vi.fn()} onCreateTasks={vi.fn()} onDelete={vi.fn()} onToggleTask={vi.fn()} onUpdateTask={vi.fn()} onDeleteTask={vi.fn()} />,
    )

    await openNewTaskForm()
    await userEvent.type(screen.getByLabelText('Nova tarefa'), 'Alongamento')

    expect(screen.getByRole('button', { name: /^criar$/i })).toBeDisabled()
  })

  it('starts with the new-task form collapsed behind "+ Nova tarefa"', async () => {
    render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )

    expect(screen.queryByLabelText('Nova tarefa')).not.toBeInTheDocument()
    await openNewTaskForm()
    expect(screen.getByLabelText('Nova tarefa')).toHaveFocus()
    expect(screen.queryByRole('button', { name: '+ Nova tarefa' })).not.toBeInTheDocument()
  })

  it('closes the form on Cancelar and keeps it open after creating a task', async () => {
    const onCreateTasks = vi.fn().mockResolvedValue(undefined)
    render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={onCreateTasks}
        onDelete={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )

    await openNewTaskForm()
    await userEvent.type(screen.getByLabelText('Nova tarefa'), 'Alongamento')
    await userEvent.click(screen.getByRole('checkbox', { name: 'TER 28' }))
    await userEvent.click(screen.getByRole('button', { name: /^criar$/i }))
    expect(onCreateTasks).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Nova tarefa')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByLabelText('Nova tarefa')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Nova tarefa' })).toBeInTheDocument()
  })

  it('shows every task with its day without expanding anything', () => {
    render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )

    const list = screen.getByRole('list', { name: 'Tarefas da semana' })
    expect(list).toHaveTextContent('28/07')
    expect(list).toHaveTextContent('Testar toggle')
    expect(list).toHaveTextContent('29/07')
    expect(list).toHaveTextContent('Testar criação')
    expect(screen.getByRole('checkbox', { name: 'Testar toggle' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Testar criação' })).not.toBeChecked()
  })

  it('marks a task done from the card', async () => {
    const onToggleTask = vi.fn().mockResolvedValue(undefined)
    render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
        onToggleTask={onToggleTask}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('checkbox', { name: 'Testar criação' }))
    expect(onToggleTask).toHaveBeenCalledWith('task-2')
  })

  it('keeps the per-day chart behind "Ver detalhes"', async () => {
    const onToggleExpand = vi.fn()
    render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={onToggleExpand}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /ver detalhes/i }))
    expect(onToggleExpand).toHaveBeenCalledOnce()
  })

  it('links the title to the dedicated weekly goal page', () => {
    render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )

    expect(screen.getByRole('link', { name: 'Cobrir fluxo de metas' })).toHaveAttribute(
      'href',
      '/objectives/obj-1/weeks/goal-1',
    )
  })

  it('shows a single empty-state message when an expanded goal has zero tasks', () => {
    const goal: WeeklyGoalWithTasks = { ...baseGoal, dailyTasks: [] }
    render(
      <WeeklyGoalCard goal={goal} expanded onToggleExpand={vi.fn()} onCreateTasks={vi.fn()} onDelete={vi.fn()} onToggleTask={vi.fn()} onUpdateTask={vi.fn()} onDeleteTask={vi.fn()} />,
    )

    expect(screen.getAllByText(/nesta semana/i)).toHaveLength(1)
    expect(screen.getByText('Sem tarefas nesta semana ainda.')).toBeInTheDocument()
  })

  it('links Editar to the dedicated edit page', () => {
    render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /editar/i })).toHaveAttribute(
      'href',
      '/objectives/obj-1/weeks/goal-1/edit',
    )
  })

  it('marks a goal that repeats every week', () => {
    render(
      <WeeklyGoalCard
        goal={{ ...baseGoal, recurring: true }}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )

    expect(screen.getByText('repete toda semana')).toBeInTheDocument()
    expect(screen.getByText('repete toda semana')).toHaveClass('text-support-foreground')
  })

  it('does not mark a one-off goal', () => {
    render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )

    expect(screen.queryByText('repete toda semana')).not.toBeInTheDocument()
  })
})
