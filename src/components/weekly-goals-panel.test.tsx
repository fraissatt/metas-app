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
  recurring: false,
  dailyTasks: [],
}

const goalB: WeeklyGoalWithTasks = {
  id: 'goal-b',
  title: 'Meta B',
  objectiveId: 'obj-1',
  weekStart: new Date('2026-07-27'),
  weekEnd: new Date('2026-08-02'),
  status: 'ACTIVE',
  recurring: false,
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
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
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
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
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
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )

    await userEvent.click(screen.getAllByRole('button', { name: '+ Nova tarefa' })[0])
    await userEvent.type(screen.getByLabelText('Nova tarefa'), 'Alongamento')
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
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /excluir/i }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /excluir/i }))

    expect(onDeleteWeeklyGoal).toHaveBeenCalledWith('goal-a')
  })

  it('opens the new-goal form inside the #nova-meta anchor when openNewGoal is set', () => {
    const { container } = render(
      <WeeklyGoalsPanel
        goals={[goalA]}
        onCreateTasks={vi.fn()}
        onCreateWeeklyGoal={vi.fn()}
        onDeleteWeeklyGoal={vi.fn()}
        onToggleTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
        openNewGoal
      />,
    )

    const anchor = container.querySelector('#nova-meta')
    expect(anchor).not.toBeNull()
    expect(within(anchor as HTMLElement).getByLabelText('Título')).toBeInTheDocument()
  })

  describe('earlier weeks', () => {
    const past = [
      { weekStart: '2026-09-28', total: 5, completed: 5 },
      { weekStart: '2026-09-21', total: 5, completed: 4 },
      { weekStart: '2026-09-14', total: 4, completed: 2 },
      { weekStart: '2026-09-07', total: 3, completed: 0 },
      { weekStart: '2026-08-31', total: 2, completed: 1 },
    ]
    const handlers = {
      onCreateTasks: vi.fn(),
      onCreateWeeklyGoal: vi.fn(),
      onDeleteWeeklyGoal: vi.fn(),
      onToggleTask: vi.fn(),
      onUpdateTask: vi.fn(),
      onDeleteTask: vi.fn(),
    }

    it('shows the 3 most recent earlier weeks as rows and the rest behind "Ver mais"', async () => {
      render(<WeeklyGoalsPanel goals={[goalA]} pastWeeks={past} onLoadWeek={vi.fn()} {...handlers} />)
      expect(screen.getByRole('button', { name: /Semana de 28\/09.*100%/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Semana de 14\/09.*50%/ })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Semana de 07\/09/ })).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Ver mais 2 semanas' }))
      expect(screen.getByRole('button', { name: /Semana de 31\/08.*50%/ })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Ver mais/ })).not.toBeInTheDocument()
    })

    it("loads a week's goals only when its row is opened, and collapses it again", async () => {
      const onLoadWeek = vi.fn().mockResolvedValue([{ ...goalB, title: 'Meta antiga' }])
      render(<WeeklyGoalsPanel goals={[goalA]} pastWeeks={past} onLoadWeek={onLoadWeek} {...handlers} />)
      expect(onLoadWeek).not.toHaveBeenCalled()

      const row = screen.getByRole('button', { name: /Semana de 21\/09/ })
      await userEvent.click(row)
      expect(onLoadWeek).toHaveBeenCalledWith('2026-09-21')
      expect(await screen.findByText('Meta antiga')).toBeInTheDocument()
      expect(row).toHaveAttribute('aria-expanded', 'true')

      await userEvent.click(row)
      expect(screen.queryByText('Meta antiga')).not.toBeInTheDocument()
    })

    it('reloads an opened week after a task changes in it', async () => {
      const onToggleTask = vi.fn().mockResolvedValue(undefined)
      const task = { id: 't-old', title: 'Tarefa antiga', weeklyGoalId: 'goal-b', date: new Date('2026-09-22'), completed: false, completedAt: null }
      const onLoadWeek = vi.fn().mockResolvedValue([{ ...goalB, dailyTasks: [task] }])
      render(<WeeklyGoalsPanel goals={[]} pastWeeks={past} onLoadWeek={onLoadWeek} {...handlers} onToggleTask={onToggleTask} />)

      await userEvent.click(screen.getByRole('button', { name: /Semana de 21\/09/ }))
      await userEvent.click(await screen.findByRole('checkbox', { name: 'Tarefa antiga' }))
      expect(onToggleTask).toHaveBeenCalledWith('t-old')
      await vi.waitFor(() => expect(onLoadWeek).toHaveBeenCalledTimes(2))
    })
  })
})
