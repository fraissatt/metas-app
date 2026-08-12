# "Hoje" + "Semana" Split Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the home page (`/`), show "Hoje" and "Progresso da semana" side-by-side on wide screens (60/40 split), with each weekly goal rendered as a ring-progress + 7-day-sparkline card that updates instantly when a task is checked off — replacing the current sequential Hoje-then-collapsible-Semana accordion.

**Architecture:** A new presentational component (`WeekGoalProgressCard`) replaces the plain `Card`+`Progress` block currently inline in `FluidDayWeek`, computing its ring/sparkline directly from the `dailyTasks` array `listWeeklyGoalsForCurrentWeek()` already fetches (removing a redundant per-goal query). `FluidDayWeek` gains a `useOptimistic`-backed shared state so a task toggle updates both the Hoje checkbox and the paired Semana card in the same frame, and a `useIsDesktop` hook that turns the existing collapse mechanics into an always-expanded, side-by-side `lg:flex-row` layout at 1024px+ while leaving the accordion untouched below that width.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19 (`useOptimistic`), TypeScript, Tailwind CSS v4, shadcn/ui, Prisma, Vitest + React Testing Library.

## Global Constraints

- No new npm dependencies — the ring is plain SVG (`stroke-dasharray`/`stroke-dashoffset`), the sparkline is plain `<div>` bars. No charting library, no tooltip library (native `title` attribute only).
- `lg` breakpoint = 1024px (Tailwind's default `lg:`), matching the desktop/wide-screen priority from the design.
- Hoje takes 60% width, "Progresso da semana" takes 40%, at `lg`+ only. Below `lg`, layout is unchanged (accordion).
- All UI copy is Portuguese, matching existing strings exactly in tone (e.g. "tarefas", "Nenhuma meta semanal para esta semana.").
- `getWeekProgress` (`src/lib/actions/weeklyGoals.ts:46`) stays as-is — it's still used by `src/lib/actions/progress.ts` and its own tests. Only `src/app/page.tsx`'s call site is removed.
- Spec: `docs/superpowers/specs/2026-08-06-hoje-semana-split-layout-design.md`.

---

### Task 1: `WeekGoalProgressCard` component (ring + sparkline)

**Files:**
- Create: `src/components/week-goal-progress-card.tsx`
- Test: `src/components/week-goal-progress-card.test.tsx`

**Interfaces:**
- Produces: `WeekGoalProgressCard({ goal }: { goal: WeeklyGoal & { objective: Objective; dailyTasks: DailyTask[] } })` — a default export is NOT used; it's a named export, matching every other component in this codebase (`TodayTaskGroup`, `FluidDayWeek`, etc.). `WeeklyGoal`, `Objective`, `DailyTask` come from `@prisma/client`.

This task is fully standalone — it is not wired into `FluidDayWeek` yet (that's Task 2). It can be reviewed and tested in isolation.

- [ ] **Step 1: Write the failing test**

Create `src/components/week-goal-progress-card.test.tsx`:

```tsx
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
  createdAt: new Date('2026-07-01'),
}

const weeklyGoal = {
  id: 'goal-1',
  title: 'Ler documentação do App Router',
  objectiveId: 'obj-1',
  weekStart: new Date('2026-07-27'), // Monday
  weekEnd: new Date('2026-08-02'),
  status: 'ACTIVE' as const,
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
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/components/week-goal-progress-card.test.tsx`
Expected: FAIL — `Cannot find module '@/components/week-goal-progress-card'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/components/week-goal-progress-card.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { isSameDay } from 'date-fns'
import type { DailyTask, Objective, WeeklyGoal } from '@prisma/client'
import { getWeekDays } from '@/lib/dates'

const DAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']
const RING_RADIUS = 16
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function WeekGoalProgressCard({
  goal,
}: {
  goal: WeeklyGoal & { objective: Objective; dailyTasks: DailyTask[] }
}) {
  const total = goal.dailyTasks.length
  const completed = goal.dailyTasks.filter((t) => t.completed).length
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  const ringOffset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE

  return (
    <div className="flex overflow-hidden rounded-lg border border-border">
      <div className="w-[3px] shrink-0 bg-primary" />
      <div className="flex-1 p-4">
        <div className="mb-3 flex flex-col text-left">
          <Link
            href={`/objectives/${goal.objective.id}/weeks/${goal.id}`}
            className="text-sm font-semibold hover:text-primary hover:underline"
          >
            {goal.title}
          </Link>
          <Link
            href={`/objectives/${goal.objective.id}`}
            className="text-xs text-muted-foreground hover:text-primary hover:underline"
          >
            {goal.objective.title}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
              <circle cx="20" cy="20" r={RING_RADIUS} fill="none" stroke="var(--muted)" strokeWidth="4" />
              <circle
                cx="20"
                cy="20"
                r={RING_RADIUS}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
                data-testid="progress-ring"
                className="transition-[stroke-dashoffset] duration-300 ease-in-out motion-reduce:transition-none"
              />
            </svg>
            <span className="absolute text-[10px] font-semibold">{percent}%</span>
          </div>

          <div className="flex h-6 flex-1 items-end gap-1">
            {getWeekDays(goal.weekStart).map((day, i) => {
              const dayTasks = goal.dailyTasks.filter((t) => isSameDay(t.date, day))
              const dayCompleted = dayTasks.filter((t) => t.completed).length
              const dayTotal = dayTasks.length
              const heightPercent = dayTotal === 0 ? 8 : Math.max(8, Math.round((dayCompleted / dayTotal) * 100))

              return (
                <div
                  key={day.toISOString()}
                  title={`${DAY_LABELS[i]}: ${dayCompleted}/${dayTotal} tarefas`}
                  className="flex-1 rounded-t-sm bg-primary transition-[height] duration-300 ease-in-out motion-reduce:transition-none"
                  style={{ height: `${heightPercent}%`, opacity: dayTotal === 0 ? 0.3 : 1 }}
                />
              )
            })}
          </div>
        </div>

        <span className="mt-2 block text-sm text-muted-foreground">
          {completed}/{total} tarefas
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/components/week-goal-progress-card.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/week-goal-progress-card.tsx src/components/week-goal-progress-card.test.tsx
git commit -m "feat: add WeekGoalProgressCard with ring + sparkline"
```

---

### Task 2: Wire `WeekGoalProgressCard` into `FluidDayWeek`, drop the `progress` prop

**Files:**
- Modify: `src/components/fluid-day-week.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/fluid-day-week.test.tsx`

**Interfaces:**
- Consumes: `WeekGoalProgressCard` from Task 1 (`{ goal }` prop).
- Produces: `FluidDayWeek`'s prop signature changes from `{ tasks, goals, progress, onToggleTask }` to `{ tasks, goals, onToggleTask }` — `progress` is gone. Later tasks (3, 4, 5) build on this signature.

**Why now:** `listWeeklyGoalsForCurrentWeek()` already includes `dailyTasks: true` per goal (`src/lib/actions/weeklyGoals.ts:56-62`) — `WeekGoalProgressCard` computes its own percent/tarefas/sparkline from that array, so the separate `getWeekProgress` query-per-goal loop in `page.tsx` becomes dead weight.

- [ ] **Step 1: Update the test to drop `progress` and assert the new card renders**

Replace the full contents of `src/components/fluid-day-week.test.tsx` with:

```tsx
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
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/components/fluid-day-week.test.tsx`
Expected: FAIL — TypeScript error on the missing `progress` prop is not the failure mode here since `progress` was removed from every call; instead expect a runtime error, since `FluidDayWeek` still reads `progress[i]` while `progress` is now `undefined` (`Cannot read properties of undefined`).

- [ ] **Step 3: Update `FluidDayWeek` and `page.tsx`**

Replace the full contents of `src/components/fluid-day-week.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { TodayTaskGroup } from '@/components/today-task-group'
import { WeekGoalProgressCard } from '@/components/week-goal-progress-card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { groupTasksByWeeklyGoal } from '@/lib/tasks'
import type { listDailyTasksByDate } from '@/lib/actions/dailyTasks'
import type { listWeeklyGoalsForCurrentWeek } from '@/lib/actions/weeklyGoals'

type DailyTasks = Awaited<ReturnType<typeof listDailyTasksByDate>>
type WeeklyGoals = Awaited<ReturnType<typeof listWeeklyGoalsForCurrentWeek>>

export function FluidDayWeek({
  tasks,
  goals,
  onToggleTask,
}: {
  tasks: DailyTasks
  goals: WeeklyGoals
  onToggleTask: (id: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Hoje</h1>
        {tasks.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma tarefa para hoje.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {groupTasksByWeeklyGoal(tasks).map((group) => (
              <TodayTaskGroup key={group.weeklyGoal.id} group={group} onToggleTask={onToggleTask} />
            ))}
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="week-section"
        className="w-full border-dashed border-primary text-primary hover:bg-primary/10 hover:text-primary"
      >
        {expanded ? 'Recolher semana' : 'Ver semana'}
        {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </Button>

      <div
        id="week-section"
        aria-hidden={!expanded}
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden" inert={!expanded}>
          <h2 className="mb-6 text-2xl font-semibold">Esta semana</h2>
          {goals.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma meta semanal para esta semana.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {goals.map((goal) => (
                <WeekGoalProgressCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

Replace the full contents of `src/app/page.tsx` with:

```tsx
import { listDailyTasksByDate, toggleDailyTask } from '@/lib/actions/dailyTasks'
import { listWeeklyGoalsForCurrentWeek } from '@/lib/actions/weeklyGoals'
import { FluidDayWeek } from '@/components/fluid-day-week'

// This page's correctness depends on the wall clock at request time (it
// filters tasks by "today" and computes "the current week" from `new
// Date()`), so it must never be statically prerendered — otherwise it freezes on the build day/week forever.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const tasks = await listDailyTasksByDate(new Date())
  const goals = await listWeeklyGoalsForCurrentWeek()

  return (
    <main className="mx-auto max-w-2xl p-8">
      <FluidDayWeek tasks={tasks} goals={goals} onToggleTask={toggleDailyTask} />
    </main>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/components/fluid-day-week.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/fluid-day-week.tsx src/components/fluid-day-week.test.tsx src/app/page.tsx
git commit -m "refactor: replace week progress cards with WeekGoalProgressCard, drop redundant per-goal query"
```

---

### Task 3: Order Semana goals so today's goals come first, with a divider

**Files:**
- Modify: `src/components/fluid-day-week.tsx`
- Modify: `src/components/fluid-day-week.test.tsx`

**Interfaces:**
- Consumes: `groupTasksByWeeklyGoal` from `src/lib/tasks.ts` (unchanged).
- Produces: no prop/signature change — internal render logic only.

- [ ] **Step 1: Add failing tests for ordering and the divider**

In `src/components/fluid-day-week.test.tsx`, add these two `it` blocks inside the existing `describe('FluidDayWeek', ...)`, after the `'shows the week goal progress card...'` test:

```tsx
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
```

Note `otherGoal` is passed **first** in the `goals` array (`[otherGoal, goal]`) specifically so the test can't pass by accident just because the input happened to already be in the right order.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- src/components/fluid-day-week.test.tsx`
Expected: FAIL — `getByText('outras metas da semana')` not found; heading order is `['Meditar', 'Ler documentação do App Router']` (goals render in input order today).

- [ ] **Step 3: Implement the split**

In `src/components/fluid-day-week.tsx`, replace:

```tsx
  const [expanded, setExpanded] = useState(false)

  return (
```

with:

```tsx
  const [expanded, setExpanded] = useState(false)

  const todayGroups = groupTasksByWeeklyGoal(tasks)
  const todayGoalIds = todayGroups.map((group) => group.weeklyGoal.id)
  const goalsWithTasksToday = todayGoalIds
    .map((id) => goals.find((goal) => goal.id === id))
    .filter((goal): goal is WeeklyGoals[number] => goal !== undefined)
  const otherGoals = goals.filter((goal) => !todayGoalIds.includes(goal.id))

  return (
```

And replace:

```tsx
          <div className="flex flex-col gap-3">
            {groupTasksByWeeklyGoal(tasks).map((group) => (
              <TodayTaskGroup key={group.weeklyGoal.id} group={group} onToggleTask={onToggleTask} />
            ))}
          </div>
```

with:

```tsx
          <div className="flex flex-col gap-3">
            {todayGroups.map((group) => (
              <TodayTaskGroup key={group.weeklyGoal.id} group={group} onToggleTask={onToggleTask} />
            ))}
          </div>
```

And replace:

```tsx
            <div className="flex flex-col gap-4">
              {goals.map((goal) => (
                <WeekGoalProgressCard key={goal.id} goal={goal} />
              ))}
            </div>
```

with:

```tsx
            <div className="flex flex-col gap-4">
              {goalsWithTasksToday.map((goal) => (
                <WeekGoalProgressCard key={goal.id} goal={goal} />
              ))}
              {goalsWithTasksToday.length > 0 && otherGoals.length > 0 && (
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  outras metas da semana
                </p>
              )}
              {otherGoals.map((goal) => (
                <WeekGoalProgressCard key={goal.id} goal={goal} />
              ))}
            </div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/components/fluid-day-week.test.tsx`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/fluid-day-week.tsx src/components/fluid-day-week.test.tsx
git commit -m "feat: order Semana goals so today's goals appear first, with a divider"
```

---

### Task 4: Shared optimistic toggle state (instant cross-column update)

**Files:**
- Modify: `src/components/fluid-day-week.tsx`
- Modify: `src/components/fluid-day-week.test.tsx`

**Interfaces:**
- Consumes: `useOptimistic` from `react` (React 19, already a project dependency).
- Produces: no external prop/signature change — `onToggleTask` keeps the same `(id: string) => Promise<void>` shape; internally it's now wrapped by a local `handleToggle` before being passed to `TodayTaskGroup`.

- [ ] **Step 1: Add a failing test for instant cross-column update**

In `src/components/fluid-day-week.test.tsx`, add this `it` block after the `'omits the divider...'` test:

```tsx
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

    expect(within(container.querySelector('#week-section')!).getByText('1/1 tarefas')).toBeInTheDocument()

    resolveToggle()
  })
```

This test deliberately never awaits `onToggleTask`'s promise before asserting `1/1 tarefas` — if the update only happened after the server action resolved, this assertion would fail while the promise is still pending.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/components/fluid-day-week.test.tsx`
Expected: FAIL — `0/1 tarefas` is still on screen after the checkbox click (the Semana card doesn't update until `page.tsx` re-renders with fresh server data, which never happens in this test since `onToggleTask`'s promise never resolves).

- [ ] **Step 3: Add `useOptimistic`**

In `src/components/fluid-day-week.tsx`, replace:

```tsx
import { useState } from 'react'
```

with:

```tsx
import { useOptimistic, useState } from 'react'
```

Replace:

```tsx
type DailyTasks = Awaited<ReturnType<typeof listDailyTasksByDate>>
type WeeklyGoals = Awaited<ReturnType<typeof listWeeklyGoalsForCurrentWeek>>

export function FluidDayWeek({
```

with:

```tsx
type DailyTasks = Awaited<ReturnType<typeof listDailyTasksByDate>>
type WeeklyGoals = Awaited<ReturnType<typeof listWeeklyGoalsForCurrentWeek>>
type ToggleState = { tasks: DailyTasks; goals: WeeklyGoals }

function toggleTaskOptimistic(state: ToggleState, taskId: string): ToggleState {
  return {
    tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task)),
    goals: state.goals.map((goal) => ({
      ...goal,
      dailyTasks: goal.dailyTasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task,
      ),
    })),
  }
}

export function FluidDayWeek({
```

Replace:

```tsx
  const [expanded, setExpanded] = useState(false)

  const todayGroups = groupTasksByWeeklyGoal(tasks)
  const todayGoalIds = todayGroups.map((group) => group.weeklyGoal.id)
  const goalsWithTasksToday = todayGoalIds
    .map((id) => goals.find((goal) => goal.id === id))
    .filter((goal): goal is WeeklyGoals[number] => goal !== undefined)
  const otherGoals = goals.filter((goal) => !todayGoalIds.includes(goal.id))

  return (
```

with:

```tsx
  const [expanded, setExpanded] = useState(false)
  const [optimisticState, applyOptimisticToggle] = useOptimistic({ tasks, goals }, toggleTaskOptimistic)

  async function handleToggle(taskId: string) {
    applyOptimisticToggle(taskId)
    await onToggleTask(taskId)
  }

  const todayGroups = groupTasksByWeeklyGoal(optimisticState.tasks)
  const todayGoalIds = todayGroups.map((group) => group.weeklyGoal.id)
  const goalsWithTasksToday = todayGoalIds
    .map((id) => optimisticState.goals.find((goal) => goal.id === id))
    .filter((goal): goal is WeeklyGoals[number] => goal !== undefined)
  const otherGoals = optimisticState.goals.filter((goal) => !todayGoalIds.includes(goal.id))

  return (
```

Replace:

```tsx
        {tasks.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma tarefa para hoje.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {todayGroups.map((group) => (
              <TodayTaskGroup key={group.weeklyGoal.id} group={group} onToggleTask={onToggleTask} />
            ))}
          </div>
        )}
```

with:

```tsx
        {optimisticState.tasks.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma tarefa para hoje.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {todayGroups.map((group) => (
              <TodayTaskGroup key={group.weeklyGoal.id} group={group} onToggleTask={handleToggle} />
            ))}
          </div>
        )}
```

Replace:

```tsx
          {goals.length === 0 ? (
```

with:

```tsx
          {optimisticState.goals.length === 0 ? (
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- src/components/fluid-day-week.test.tsx`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/fluid-day-week.tsx src/components/fluid-day-week.test.tsx
git commit -m "feat: apply optimistic task toggle so Hoje and Semana update together instantly"
```

---

### Task 5: Side-by-side `lg:flex-row` layout (60/40), no accordion at `lg`+

**Files:**
- Modify: `src/components/fluid-day-week.tsx`
- Modify: `src/components/fluid-day-week.test.tsx`

**Interfaces:**
- Produces: `FluidDayWeek` renders Hoje and "Progresso da semana" as a `flex-row` pair at `lg`+ (1024px), both always expanded — no other component depends on this internally, it's the final visible behavior.

**Note on what this task's tests can and can't verify:** the `Button`'s own visibility at `lg`+ is controlled purely by the Tailwind `lg:hidden` CSS class. Vitest's jsdom environment does not load or apply the project's actual Tailwind stylesheet, so a real browser will hide the button at 1024px+ but a jsdom test cannot observe that (the class name is present in the DOM either way). What tests *can* verify — and what actually matters for correctness — is the JS-driven state: whether the week section is expanded (`aria-hidden`, `inert`) without the user clicking anything, once the viewport is reported as desktop-width via `matchMedia`.

- [ ] **Step 1: Add `matchMedia` mocking and a failing desktop-layout test**

Replace the full contents of `src/components/fluid-day-week.test.tsx` with (this adds a `mockMatchMedia` helper, a `beforeEach` defaulting to mobile-width, and one new test at the end — everything else is unchanged from Task 4):

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

    expect(within(container.querySelector('#week-section')!).getByText('1/1 tarefas')).toBeInTheDocument()

    resolveToggle()
  })

  it('shows the week section without collapsing when the viewport is desktop-width (lg+)', () => {
    mockMatchMedia(true)

    const { container } = render(<FluidDayWeek tasks={[task]} goals={[goal]} onToggleTask={vi.fn()} />)

    expect(container.querySelector('#week-section')).toHaveAttribute('aria-hidden', 'false')
    expect(within(container.querySelector('#week-section')!).getByText('0/1 tarefas')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify the new one fails (and the rest still pass)**

Run: `npm run test -- src/components/fluid-day-week.test.tsx`
Expected: 13 PASS, 1 FAIL — `'shows the week section without collapsing...'` fails because `aria-hidden` is still `'true'` (nothing yet reads `matchMedia`).

- [ ] **Step 3: Add `useIsDesktop` and the responsive layout**

In `src/components/fluid-day-week.tsx`, replace:

```tsx
import { useOptimistic, useState } from 'react'
```

with:

```tsx
import { useEffect, useOptimistic, useState } from 'react'
```

Replace:

```tsx
export function FluidDayWeek({
```

with:

```tsx
function useIsDesktop(breakpointPx = 1024): boolean {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${breakpointPx}px)`)
    setIsDesktop(mql.matches)
    const handleChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [breakpointPx])

  return isDesktop
}

export function FluidDayWeek({
```

Replace:

```tsx
  const [expanded, setExpanded] = useState(false)
  const [optimisticState, applyOptimisticToggle] = useOptimistic({ tasks, goals }, toggleTaskOptimistic)
```

with:

```tsx
  const [expanded, setExpanded] = useState(false)
  const isDesktop = useIsDesktop()
  const effectiveExpanded = expanded || isDesktop
  const [optimisticState, applyOptimisticToggle] = useOptimistic({ tasks, goals }, toggleTaskOptimistic)
```

Replace the entire `return (...)` block with:

```tsx
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <div className="lg:basis-3/5">
        <h1 className="mb-6 text-2xl font-semibold">Hoje</h1>
        {optimisticState.tasks.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma tarefa para hoje.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {todayGroups.map((group) => (
              <TodayTaskGroup key={group.weeklyGoal.id} group={group} onToggleTask={handleToggle} />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:basis-2/5">
        <Button
          type="button"
          variant="outline"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={effectiveExpanded}
          aria-controls="week-section"
          className="w-full border-dashed border-primary text-primary hover:bg-primary/10 hover:text-primary lg:hidden"
        >
          {expanded ? 'Recolher semana' : 'Ver semana'}
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>

        <div
          id="week-section"
          aria-hidden={!effectiveExpanded}
          className={cn(
            'grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none',
            effectiveExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden" inert={!effectiveExpanded}>
            <h2 className="mb-6 text-2xl font-semibold">Esta semana</h2>
            {optimisticState.goals.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma meta semanal para esta semana.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {goalsWithTasksToday.map((goal) => (
                  <WeekGoalProgressCard key={goal.id} goal={goal} />
                ))}
                {goalsWithTasksToday.length > 0 && otherGoals.length > 0 && (
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    outras metas da semana
                  </p>
                )}
                {otherGoals.map((goal) => (
                  <WeekGoalProgressCard key={goal.id} goal={goal} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they all pass**

Run: `npm run test -- src/components/fluid-day-week.test.tsx`
Expected: PASS (14 tests).

Then run the full suite to make sure nothing else broke:

Run: `npm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/fluid-day-week.tsx src/components/fluid-day-week.test.tsx
git commit -m "feat: show Hoje and Semana side-by-side (60/40) at lg+ instead of an accordion"
```

---

## Manual verification (after Task 5)

Automated tests can't see real CSS or animation. Once all 5 tasks are done:

1. `npm run dev`, open `/` at a viewport ≥1024px wide.
2. Confirm Hoje (left, wider) and "Progresso da semana" (right, narrower) render side-by-side with no "Ver semana" button visible, and goals with a task today appear above the "outras metas da semana" divider.
3. Check a task's checkbox in Hoje and confirm the matching goal's ring and sparkline bar in the Semana column animate immediately, without a page reload/flicker.
4. Resize the window below 1024px and confirm the "Ver semana"/"Recolher semana" accordion behavior from before this change still works, now showing `WeekGoalProgressCard`s instead of the old plain progress bars.
5. Reload the page (fresh server data) and confirm the toggled task's state persisted correctly (the optimistic update reconciled with the real server state, not just a visual illusion).
