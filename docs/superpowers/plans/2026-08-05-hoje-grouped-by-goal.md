# "Hoje" Tab — Group Tasks by Weekly Goal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat, one-`Card`-per-task list in the "Hoje" section of `FluidDayWeek` with tasks grouped by their weekly goal, so the goal/objective context is shown once per group instead of repeated on every task.

**Architecture:** A pure grouping function turns the flat `tasks` array into ordered groups (first-appearance order, no new sorting). A new presentational component `TodayTaskGroup` renders one group (header with goal/objective links + progress badge, then task rows). `FluidDayWeek` composes the two, replacing its current inline `.map()` over tasks.

**Tech Stack:** Next.js (App Router), React Server/Client Components, Tailwind v4 (utility classes mapped to CSS custom properties in `globals.css`), Prisma types, Vitest + React Testing Library.

## Global Constraints

- Style with Tailwind utility classes that map to the existing design tokens (`bg-accent`, `text-primary`, `border-border`, `bg-card`, `text-muted-foreground`) — no new inline styles or hardcoded hex colors, matching every other component in `src/components/`.
- Row hover must use `hover:bg-accent` (a dark green tint), never a plain/white background — this was the explicit reason for revisiting the layout (see `docs/superpowers/specs/2026-08-05-hoje-grouped-by-goal-design.md`).
- Groups are ordered by first appearance of their weekly goal in the incoming `tasks` array. No alphabetical or other new sort.
- Both the weekly goal title and the objective title in a group header are clickable links (`/objectives/[objectiveId]/weeks/[goalId]` and `/objectives/[objectiveId]` respectively) — confirmed with the user during brainstorming.
- Test with Vitest + Testing Library, following the existing style in `src/components/fluid-day-week.test.tsx` and `src/lib/dates.test.ts` (plain fixture objects, no mocking framework beyond `vi.fn()`).
- Run tests with `npx vitest run <path>` for a single file, `npm test` for the full suite.

---

### Task 1: Grouping helper — `groupTasksByWeeklyGoal`

**Files:**
- Create: `src/lib/tasks.ts`
- Test: `src/lib/tasks.test.ts`

**Interfaces:**
- Produces: `export type TaskWithGoal = DailyTask & { weeklyGoal: WeeklyGoal & { objective: Objective } }` (matches the return type of `listDailyTasksByDate` in `src/lib/actions/dailyTasks.ts:75-86`, which already resolves to `Array<DailyTask & { weeklyGoal: WeeklyGoal & { objective: Objective } }>`)
- Produces: `export type TaskGroup = { weeklyGoal: WeeklyGoal & { objective: Objective }; tasks: TaskWithGoal[] }`
- Produces: `export function groupTasksByWeeklyGoal(tasks: TaskWithGoal[]): TaskGroup[]`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tasks.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { groupTasksByWeeklyGoal, type TaskWithGoal } from '@/lib/tasks'

const objective = {
  id: 'obj-1',
  title: 'Organizar finanças',
  description: null,
  startDate: new Date('2026-07-01'),
  targetDate: null,
  status: 'ACTIVE' as const,
  createdAt: new Date('2026-07-01'),
}

const otherObjective = { ...objective, id: 'obj-2', title: 'Aprender inglês' }

const goalA = {
  id: 'goal-a',
  title: 'Revisar orçamento mensal',
  objectiveId: 'obj-1',
  weekStart: new Date('2026-08-03'),
  weekEnd: new Date('2026-08-09'),
  status: 'ACTIVE' as const,
  objective,
}

const goalB = {
  id: 'goal-b',
  title: 'Praticar conversação',
  objectiveId: 'obj-2',
  weekStart: new Date('2026-08-03'),
  weekEnd: new Date('2026-08-09'),
  status: 'ACTIVE' as const,
  objective: otherObjective,
}

function makeTask(overrides: Partial<TaskWithGoal> & { id: string; weeklyGoal: TaskWithGoal['weeklyGoal'] }): TaskWithGoal {
  return {
    title: 'Tarefa',
    weeklyGoalId: overrides.weeklyGoal.id,
    date: new Date('2026-08-05'),
    completed: false,
    completedAt: null,
    ...overrides,
  }
}

describe('groupTasksByWeeklyGoal', () => {
  it('returns an empty array for no tasks', () => {
    expect(groupTasksByWeeklyGoal([])).toEqual([])
  })

  it('puts tasks that share a weekly goal into one group', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Categorizar gastos', weeklyGoal: goalA }),
      makeTask({ id: 't2', title: 'Cancelar assinaturas', weeklyGoal: goalA }),
    ]

    const groups = groupTasksByWeeklyGoal(tasks)

    expect(groups).toHaveLength(1)
    expect(groups[0].weeklyGoal.id).toBe('goal-a')
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('orders groups by first appearance of their weekly goal', () => {
    const tasks = [
      makeTask({ id: 't1', weeklyGoal: goalB }),
      makeTask({ id: 't2', weeklyGoal: goalA }),
      makeTask({ id: 't3', weeklyGoal: goalB }),
    ]

    const groups = groupTasksByWeeklyGoal(tasks)

    expect(groups.map((g) => g.weeklyGoal.id)).toEqual(['goal-b', 'goal-a'])
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['t1', 't3'])
    expect(groups[1].tasks.map((t) => t.id)).toEqual(['t2'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/tasks.test.ts`
Expected: FAIL — `Cannot find module '@/lib/tasks'` (file doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/tasks.ts`:

```ts
import type { DailyTask, Objective, WeeklyGoal } from '@prisma/client'

export type TaskWithGoal = DailyTask & { weeklyGoal: WeeklyGoal & { objective: Objective } }

export type TaskGroup = {
  weeklyGoal: WeeklyGoal & { objective: Objective }
  tasks: TaskWithGoal[]
}

export function groupTasksByWeeklyGoal(tasks: TaskWithGoal[]): TaskGroup[] {
  const order: string[] = []
  const byGoal = new Map<string, TaskGroup>()

  for (const task of tasks) {
    const goalId = task.weeklyGoal.id
    if (!byGoal.has(goalId)) {
      order.push(goalId)
      byGoal.set(goalId, { weeklyGoal: task.weeklyGoal, tasks: [] })
    }
    byGoal.get(goalId)!.tasks.push(task)
  }

  return order.map((goalId) => byGoal.get(goalId)!)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/tasks.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tasks.ts src/lib/tasks.test.ts
git commit -m "feat: add groupTasksByWeeklyGoal helper for the Hoje tab"
```

---

### Task 2: `TodayTaskGroup` component + wire into `FluidDayWeek`

**Files:**
- Create: `src/components/today-task-group.tsx`
- Modify: `src/components/fluid-day-week.tsx:1-61` (imports and the "Hoje" task list block)
- Test: `src/components/fluid-day-week.test.tsx`

**Interfaces:**
- Consumes: `groupTasksByWeeklyGoal(tasks: TaskWithGoal[]): TaskGroup[]` and `type TaskGroup` from `@/lib/tasks` (Task 1)
- Consumes: `TaskToggle({ taskId, completed, action }: { taskId: string; completed: boolean; action: (id: string) => Promise<void> })` from `@/components/task-toggle` (existing, unchanged)
- Produces: `TodayTaskGroup({ group, onToggleTask }: { group: TaskGroup; onToggleTask: (id: string) => Promise<void> })` — default export is a named export `TodayTaskGroup`

- [ ] **Step 1: Write the first failing test — one group for tasks sharing a goal**

In `src/components/fluid-day-week.test.tsx`, add a second task fixture sharing `task`'s weekly goal, and a new test. Insert near the top, after the existing `task` constant:

```ts
const task2 = {
  id: 'task-2',
  title: 'Reler capítulo 3',
  weeklyGoalId: 'goal-1',
  date: new Date('2026-07-30'),
  completed: true,
  completedAt: new Date('2026-07-30'),
  weeklyGoal: { ...weeklyGoal, objective },
}
```

Add this test inside the `describe('FluidDayWeek', ...)` block:

```ts
  it('groups tasks that share a weekly goal under one header', () => {
    render(
      <FluidDayWeek
        tasks={[task, task2]}
        goals={[goal]}
        progress={[{ total: 2, completed: 1, percent: 50 }]}
        onToggleTask={vi.fn()}
      />,
    )

    expect(screen.getAllByText('Ler documentação do App Router')).toHaveLength(1)
    expect(screen.getByText('Revisar App Router')).toBeInTheDocument()
    expect(screen.getByText('Reler capítulo 3')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/fluid-day-week.test.tsx -t "groups tasks that share a weekly goal"`
Expected: FAIL — the badge text `1/2` and single group header don't exist yet (current code renders two separate cards, each repeating the goal title, so `getAllByText('Ler documentação do App Router')` would have length 2, not 1).

- [ ] **Step 3: Create `TodayTaskGroup` and wire it into `FluidDayWeek`**

Create `src/components/today-task-group.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { TaskToggle } from '@/components/task-toggle'
import type { TaskGroup } from '@/lib/tasks'

export function TodayTaskGroup({
  group,
  onToggleTask,
}: {
  group: TaskGroup
  onToggleTask: (id: string) => Promise<void>
}) {
  const { weeklyGoal, tasks } = group
  const completed = tasks.filter((t) => t.completed).length

  return (
    <div className="flex overflow-hidden rounded-lg border border-border">
      <div className="w-[3px] shrink-0 bg-primary" />
      <div className="flex-1">
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col text-left">
            <Link
              href={`/objectives/${weeklyGoal.objective.id}/weeks/${weeklyGoal.id}`}
              className="text-sm font-semibold hover:text-primary hover:underline"
            >
              {weeklyGoal.title}
            </Link>
            <Link
              href={`/objectives/${weeklyGoal.objective.id}`}
              className="text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              {weeklyGoal.objective.title}
            </Link>
          </div>
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-primary">
            {completed}/{tasks.length}
          </span>
        </div>
        <div className="flex flex-col">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 border-b border-border/60 px-4 py-2 last:border-b-0 hover:bg-accent"
            >
              <TaskToggle taskId={task.id} completed={task.completed} action={onToggleTask} />
              <span
                className={`break-words text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}
              >
                {task.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

In `src/components/fluid-day-week.tsx`, replace the imports block:

```tsx
import { TaskToggle } from '@/components/task-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { listDailyTasksByDate } from '@/lib/actions/dailyTasks'
import type { listWeeklyGoalsForCurrentWeek } from '@/lib/actions/weeklyGoals'
```

with:

```tsx
import { TodayTaskGroup } from '@/components/today-task-group'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { groupTasksByWeeklyGoal } from '@/lib/tasks'
import type { listDailyTasksByDate } from '@/lib/actions/dailyTasks'
import type { listWeeklyGoalsForCurrentWeek } from '@/lib/actions/weeklyGoals'
```

(`TaskToggle` is no longer used directly in this file — it moved into `TodayTaskGroup` — so it's replaced, not kept alongside the new import.)

Then replace the "Hoje" task list block:

```tsx
        {tasks.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma tarefa para hoje.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {tasks.map((task) => (
              <Card key={task.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    <Link href={`/objectives/${task.weeklyGoal.objective.id}`}>
                      {task.weeklyGoal.objective.title}
                    </Link>
                    {' · '}
                    {task.weeklyGoal.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-start gap-3">
                  <TaskToggle taskId={task.id} completed={task.completed} action={onToggleTask} />
                  <span
                    className={`break-words ${task.completed ? 'line-through text-muted-foreground' : ''}`}
                  >
                    {task.title}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
```

with:

```tsx
        {tasks.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma tarefa para hoje.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {groupTasksByWeeklyGoal(tasks).map((group) => (
              <TodayTaskGroup key={group.weeklyGoal.id} group={group} onToggleTask={onToggleTask} />
            ))}
          </div>
        )}
```

Note: `Link` is still used further down in this file (the "Esta semana" goal cards), so its import stays as-is — only the imports shown above change.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/fluid-day-week.test.tsx -t "groups tasks that share a weekly goal"`
Expected: PASS

- [ ] **Step 5: Write the second failing test — separate goals produce separate, ordered groups**

Add to `src/components/fluid-day-week.test.tsx`:

```ts
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

    render(
      <FluidDayWeek
        tasks={[task, financeTask]}
        goals={[goal]}
        progress={[{ total: 1, completed: 0, percent: 0 }]}
        onToggleTask={vi.fn()}
      />,
    )

    const headings = screen.getAllByRole('link', { name: /Ler documentação|Revisar orçamento/ })
    expect(headings.map((el) => el.textContent)).toEqual(['Ler documentação do App Router', 'Revisar orçamento mensal'])
  })
```

- [ ] **Step 6: Run the test to verify it fails, then passes**

Run: `npx vitest run src/components/fluid-day-week.test.tsx -t "renders one group per distinct weekly goal"`
Expected first run: this test should already PASS given Step 3's implementation (grouping + ordering both come from `groupTasksByWeeklyGoal`, already implemented and tested in Task 1). If it fails, the bug is in the `TodayTaskGroup`/`FluidDayWeek` wiring from Step 3 — fix there, not by changing `groupTasksByWeeklyGoal`.

- [ ] **Step 7: Write the third test — group header links point to the right pages**

Add to `src/components/fluid-day-week.test.tsx`:

```ts
  it('links the group header to the weekly goal page and the objective page', () => {
    render(
      <FluidDayWeek
        tasks={[task]}
        goals={[goal]}
        progress={[{ total: 1, completed: 0, percent: 0 }]}
        onToggleTask={vi.fn()}
      />,
    )

    expect(screen.getByRole('link', { name: 'Ler documentação do App Router' })).toHaveAttribute(
      'href',
      '/objectives/obj-1/weeks/goal-1',
    )
    expect(screen.getByRole('link', { name: 'Aprender Next.js 16' })).toHaveAttribute('href', '/objectives/obj-1')
  })
```

- [ ] **Step 8: Run the full test file**

Run: `npx vitest run src/components/fluid-day-week.test.tsx`
Expected: PASS — all existing tests plus the three new ones (8 total).

- [ ] **Step 9: Run the whole suite to check for regressions**

Run: `npm test`
Expected: PASS — no other file imports the removed `TaskToggle`/`Card` usage from `fluid-day-week.tsx` in a way that breaks.

- [ ] **Step 10: Commit**

```bash
git add src/components/today-task-group.tsx src/components/fluid-day-week.tsx src/components/fluid-day-week.test.tsx
git commit -m "feat: group Hoje tasks by weekly goal in a shared header"
```

---

## Self-Review Notes

- **Spec coverage:** first-appearance ordering (Task 1), group header with both links + badge (Task 2 Step 3), row hover via `bg-accent` (Task 2 Step 3), "Esta semana" section untouched (no edits to that block in Task 2), empty state untouched (the `tasks.length === 0` branch is left as-is). All spec requirements map to a task.
- **Type consistency:** `TaskGroup`/`TaskWithGoal` defined once in Task 1 and imported (not redefined) in Task 2. `TodayTaskGroup`'s prop name `group` and `onToggleTask` match how `FluidDayWeek` calls it in Step 3.
- **No placeholders:** every step has literal code, exact file paths, and exact commands.
