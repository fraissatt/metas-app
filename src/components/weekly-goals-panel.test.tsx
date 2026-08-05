import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeeklyGoalsPanel } from '@/components/weekly-goals-panel'
import type { WeeklyGoalWithTasks } from '@/lib/actions/weeklyGoals'

const goalA: WeeklyGoalWithTasks = {
  id: 'goal-a',
  title: 'Meta A',
  objectiveId: 'obj-1',
  weekStart: new Date('2026-07-27'),
  weekEnd: new Date('2026-08-02'),
  status: 'ACTIVE',
  dailyTasks: [],
}

const goalB: WeeklyGoalWithTasks = {
  id: 'goal-b',
  title: 'Meta B',
  objectiveId: 'obj-1',
  weekStart: new Date('2026-07-27'),
  weekEnd: new Date('2026-08-02'),
  status: 'ACTIVE',
  dailyTasks: [],
}

describe('WeeklyGoalsPanel', () => {
  it('renders one card per goal plus the add-goal card', () => {
    render(
      <WeeklyGoalsPanel
        goals={[goalA, goalB]}
        onCreateTasks={vi.fn()}
        onCreateWeeklyGoal={vi.fn()}
        onDeleteWeeklyGoal={vi.fn()}
      />,
    )

    expect(screen.getByText('Meta A')).toBeInTheDocument()
    expect(screen.getByText('Meta B')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nova meta semanal/i })).toBeInTheDocument()
  })

  it('expanding one card collapses any previously expanded card', async () => {
    render(
      <WeeklyGoalsPanel
        goals={[goalA, goalB]}
        onCreateTasks={vi.fn()}
        onCreateWeeklyGoal={vi.fn()}
        onDeleteWeeklyGoal={vi.fn()}
      />,
    )

    const [detailsA, detailsB] = screen.getAllByRole('button', { name: /ver detalhes/i })
    await userEvent.click(detailsA)
    expect(screen.getByRole('button', { name: /ver menos/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /ver detalhes/i })).toHaveLength(1)

    await userEvent.click(detailsB)
    expect(screen.getByRole('button', { name: /ver menos/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /ver detalhes/i })).toHaveLength(1)
  })

  it('passes the goal id through to onCreateTasks', async () => {
    const onCreateTasks = vi.fn().mockResolvedValue(undefined)
    render(
      <WeeklyGoalsPanel
        goals={[goalA]}
        onCreateTasks={onCreateTasks}
        onCreateWeeklyGoal={vi.fn()}
        onDeleteWeeklyGoal={vi.fn()}
      />,
    )

    await userEvent.type(screen.getByPlaceholderText('Nova tarefa'), 'Alongamento')
    await userEvent.click(screen.getByRole('checkbox', { name: 'TER 27' }))
    await userEvent.click(screen.getByRole('button', { name: /^criar$/i }))

    expect(onCreateTasks).toHaveBeenCalledWith('goal-a', expect.any(FormData))
  })

  it('passes the goal id through to onDeleteWeeklyGoal', async () => {
    const onDeleteWeeklyGoal = vi.fn().mockResolvedValue(undefined)
    render(
      <WeeklyGoalsPanel
        goals={[goalA]}
        onCreateTasks={vi.fn()}
        onCreateWeeklyGoal={vi.fn()}
        onDeleteWeeklyGoal={onDeleteWeeklyGoal}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /excluir/i }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /excluir/i }))

    expect(onDeleteWeeklyGoal).toHaveBeenCalledWith('goal-a')
  })
})
