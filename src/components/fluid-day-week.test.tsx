import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FluidDayWeek, toggleTaskOptimistic, useIsDesktop } from '@/components/fluid-day-week'

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
  weekStart: new Date('2026-07-27'),
  weekEnd: new Date('2026-08-02'),
  status: 'ACTIVE' as const,
  recurring: false,
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

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

describe('FluidDayWeek', () => {
  beforeEach(() => {
    mockMatchMedia(false)
  })

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
        recurring: false,
        objective: {
          id: 'obj-finance',
          title: 'Organizar finanças',
          description: null,
          startDate: new Date('2026-07-01'),
          targetDate: null,
          status: 'ACTIVE' as const,
          completedAt: null,
          createdAt: new Date('2026-07-01'),
          userId: 'test-user',
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

  it('shows empty-state copy and a way to add work when there are no tasks or goals', () => {
    render(<FluidDayWeek tasks={[]} goals={[]} onToggleTask={vi.fn()} />)

    expect(screen.getByText('Nenhuma tarefa para hoje.')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma meta semanal para esta semana.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /adicionar tarefa/i })).toHaveAttribute(
      'href',
      '/objectives',
    )
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
      recurring: false,
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

  it('orders multiple today-goals by their first appearance in tasks, not by their position in goals', async () => {
    const goalA = { ...weeklyGoal, id: 'goal-a', title: 'Meta A', objective }
    const goalB = { ...weeklyGoal, id: 'goal-b', title: 'Meta B', objective }
    const taskA = { ...task, id: 'task-a', weeklyGoalId: 'goal-a', weeklyGoal: goalA }
    const taskB = { ...task, id: 'task-b', weeklyGoalId: 'goal-b', weeklyGoal: goalB }

    // tasks reference goal-b before goal-a; goals lists goal-a before goal-b.
    // The rendered order must follow tasks (goal-b, goal-a), not goals.
    const { container } = render(
      <FluidDayWeek
        tasks={[taskB, taskA]}
        goals={[
          { ...goalA, dailyTasks: [taskA] },
          { ...goalB, dailyTasks: [taskB] },
        ]}
        onToggleTask={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /ver semana/i }))

    const panel = within(container.querySelector('#week-section')!)
    const headingOrder = panel.getAllByRole('link', { name: /Meta A|Meta B/ }).map((el) => el.textContent)
    expect(headingOrder).toEqual(['Meta B', 'Meta A'])
  })

  it('omits the divider and shows no today-goals when nothing has a task today', async () => {
    const otherGoal = {
      id: 'goal-2',
      title: 'Meditar',
      objectiveId: 'obj-1',
      weekStart: new Date('2026-07-27'),
      weekEnd: new Date('2026-08-02'),
      status: 'ACTIVE' as const,
      recurring: false,
      objective,
      dailyTasks: [],
    }

    const { container } = render(<FluidDayWeek tasks={[]} goals={[otherGoal]} onToggleTask={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /ver semana/i }))

    const panel = within(container.querySelector('#week-section')!)
    expect(panel.queryByText('outras metas da semana')).not.toBeInTheDocument()
    expect(panel.getByRole('link', { name: 'Meditar' })).toBeInTheDocument()
  })

  it('updates the week goal progress card immediately when a task is toggled, before the server action resolves', async () => {
    let resolveToggle: () => void = () => {}
    const onToggleTask = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveToggle = resolve
        }),
    )

    const { container } = render(<FluidDayWeek tasks={[task]} goals={[goal]} onToggleTask={onToggleTask} />)

    await userEvent.click(screen.getByRole('button', { name: /ver semana/i }))
    expect(within(container.querySelector('#week-section')!).getByText('0/1 tarefas')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox'))

    expect(within(container.querySelector('#week-section')!).getByText('✓ concluída')).toBeInTheDocument()

    resolveToggle()
  })

  it('shows the week section without collapsing when the viewport is desktop-width (lg+)', () => {
    mockMatchMedia(true)

    const { container } = render(<FluidDayWeek tasks={[task]} goals={[goal]} onToggleTask={vi.fn()} />)

    expect(container.querySelector('#week-section')).toHaveAttribute('aria-hidden', 'false')
    expect(within(container.querySelector('#week-section')!).getByText('0/1 tarefas')).toBeInTheDocument()
  })
})

describe('toggleTaskOptimistic', () => {
  it('flips the matching task in both tasks and the owning goal\'s dailyTasks', () => {
    const state = { tasks: [task], goals: [goal] }

    const next = toggleTaskOptimistic(state, 'task-1')

    expect(next.tasks[0].completed).toBe(true)
    expect(next.goals[0].dailyTasks[0].completed).toBe(true)
  })

  it('does not mutate the original state', () => {
    const state = { tasks: [task], goals: [goal] }

    toggleTaskOptimistic(state, 'task-1')

    expect(state.tasks[0].completed).toBe(false)
    expect(state.goals[0].dailyTasks[0].completed).toBe(false)
  })

  it('is a no-op for a task id that matches nothing', () => {
    const state = { tasks: [task], goals: [goal] }

    const next = toggleTaskOptimistic(state, 'no-such-task')

    expect(next.tasks[0].completed).toBe(false)
    expect(next.goals[0].dailyTasks[0].completed).toBe(false)
  })

  it('only flips the targeted task, leaving others in the same goal untouched', () => {
    const state = { tasks: [task, task2], goals: [{ ...goal, dailyTasks: [task, task2] }] }

    const next = toggleTaskOptimistic(state, 'task-1')

    expect(next.goals[0].dailyTasks.find((t) => t.id === 'task-1')?.completed).toBe(true)
    expect(next.goals[0].dailyTasks.find((t) => t.id === 'task-2')?.completed).toBe(true) // task2 starts completed:true, untouched
  })
})

function IsDesktopProbe({ breakpointPx }: { breakpointPx: number }) {
  const isDesktop = useIsDesktop(breakpointPx)
  return <span>{isDesktop ? 'desktop' : 'not-desktop'}</span>
}

describe('useIsDesktop', () => {
  it('re-evaluates against the new breakpoint when breakpointPx changes, instead of reusing a stale MediaQueryList', () => {
    // Viewport is fixed at 1200px; matches is derived from each query's
    // own min-width, so a stale cached MediaQueryList (still queried for
    // the old breakpoint) would give the wrong answer for the new one.
    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      const minWidth = Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0)
      return {
        matches: 1200 >= minWidth,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
    }) as unknown as typeof window.matchMedia

    const { rerender, getByText } = render(<IsDesktopProbe breakpointPx={1024} />)
    expect(getByText('desktop')).toBeInTheDocument() // 1200 >= 1024

    rerender(<IsDesktopProbe breakpointPx={1440} />)
    expect(getByText('not-desktop')).toBeInTheDocument() // 1200 < 1440
  })
})
