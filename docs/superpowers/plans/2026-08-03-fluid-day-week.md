# Fluid Hoje/Semana View (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the separate "Hoje" (`/`) and "Semana" (`/week`) pages into one fluid view on `/`, where today's tasks show by default and an explicit toggle smoothly expands to reveal the current week's goals below them, with no navigation and no second data fetch.

**Architecture:** `src/app/page.tsx` stays a Server Component and fetches both datasets (today's tasks, current week's goals + progress) in one request, passing them as props to a new client component `FluidDayWeek` that owns only the expand/collapse UI state. The accordion animates via CSS Grid's `grid-template-rows: 0fr → 1fr` trick, so no JS height measurement is needed. `src/app/week/page.tsx` becomes a one-line redirect to `/`. `sidebar.tsx` drops its now-unused `Semana` nav entry.

**Tech Stack:** Next.js 16.2.12 (App Router), React 19.2.4, Tailwind CSS v4, shadcn components (`Card`, `Progress`, `Button`, `Checkbox`) built on `@base-ui/react`, `lucide-react` icons, Vitest + React Testing Library.

## Global Constraints

- "Macro" means the weekly-goals-with-progress view (today's `/week` content) — not a day-by-day Mon–Sun breakdown. No new data-fetching logic; reuse `listDailyTasksByDate`, `listWeeklyGoalsForCurrentWeek`, `getWeekProgress` exactly as they're called today.
- The expand/collapse state is client-only UI state (`useState`), always starts `false`/collapsed, and is never persisted (no `localStorage`, no URL query param).
- Both datasets are fetched server-side up front — expanding must never trigger a new fetch or show a loading state.
- `TaskToggle`'s completion-toggle action stays injected as a prop (matching the existing DI pattern used by `task-toggle.test.tsx`), not imported directly inside `FluidDayWeek`, so `FluidDayWeek`'s own tests never touch the database.
- `/week` must redirect to `/` (307, Next's default outside Server Actions) rather than 404 — confirmed against `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`: `redirect` is valid to call directly during Server Component rendering.
- Prisma model shapes (exact fields, no more/less) per `prisma/schema.prisma`:
  - `Objective`: `id, title, description, startDate, targetDate, status, createdAt` (no `updatedAt`)
  - `WeeklyGoal`: `id, title, objectiveId, weekStart, weekEnd, status` (no `createdAt`/`updatedAt`)
  - `DailyTask`: `id, title, weeklyGoalId, date, completed, completedAt` (no `createdAt`/`updatedAt`)

---

### Task 1: `FluidDayWeek` component

**Files:**
- Create: `src/components/fluid-day-week.tsx`
- Test: `src/components/fluid-day-week.test.tsx`

**Interfaces:**
- Consumes: `Button` (`@/components/ui/button`), `Card`/`CardHeader`/`CardTitle`/`CardContent` (`@/components/ui/card`), `Progress` (`@/components/ui/progress`), `TaskToggle` (`@/components/task-toggle`, signature `{ taskId: string; completed: boolean; action: (id: string) => Promise<void> }`), `cn` (`@/lib/utils`), `ChevronDown`/`ChevronUp` (`lucide-react`), `Link` (`next/link`).
- Produces: `export function FluidDayWeek(props: { tasks: DailyTasks; goals: WeeklyGoals; progress: Array<{ total: number; completed: number; percent: number }>; onToggleTask: (id: string) => Promise<void> }): JSX.Element`, where `DailyTasks = Awaited<ReturnType<typeof listDailyTasksByDate>>` and `WeeklyGoals = Awaited<ReturnType<typeof listWeeklyGoalsForCurrentWeek>>` (types imported with `import type` from `@/lib/actions/dailyTasks` and `@/lib/actions/weeklyGoals` — type-only imports are erased at compile time, so this never creates a runtime reference into a `'use server'` file). Consumed by Task 2's `src/app/page.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/fluid-day-week.test.tsx`:

```tsx
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
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/fluid-day-week.test.tsx`
Expected: FAIL — `Cannot find module '@/components/fluid-day-week'` (the file doesn't exist yet).

- [ ] **Step 3: Write the `FluidDayWeek` component**

Create `src/components/fluid-day-week.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { TaskToggle } from '@/components/task-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { listDailyTasksByDate } from '@/lib/actions/dailyTasks'
import type { listWeeklyGoalsForCurrentWeek } from '@/lib/actions/weeklyGoals'

type DailyTasks = Awaited<ReturnType<typeof listDailyTasksByDate>>
type WeeklyGoals = Awaited<ReturnType<typeof listWeeklyGoalsForCurrentWeek>>

export function FluidDayWeek({
  tasks,
  goals,
  progress,
  onToggleTask,
}: {
  tasks: DailyTasks
  goals: WeeklyGoals
  progress: Array<{ total: number; completed: number; percent: number }>
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
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full border-dashed border-primary text-primary hover:bg-primary/10 hover:text-primary"
      >
        {expanded ? 'Recolher semana' : 'Ver semana'}
        {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </Button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <h2 className="mb-6 text-2xl font-semibold">Esta semana</h2>
          {goals.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma meta semanal para esta semana.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {goals.map((goal, i) => (
                <Card key={goal.id}>
                  <CardHeader>
                    <CardTitle>
                      <Link href={`/objectives/${goal.objective.id}/weeks/${goal.id}`}>{goal.title}</Link>
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {goal.objective.title}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <Progress value={progress[i].percent} />
                    <span className="text-sm text-muted-foreground">
                      {progress[i].completed}/{progress[i].total} tarefas ({progress[i].percent}%)
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/fluid-day-week.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/fluid-day-week.tsx src/components/fluid-day-week.test.tsx
git commit -m "feat: add FluidDayWeek component with expand/collapse week section"
```

---

### Task 2: Wire `/` to `FluidDayWeek` and redirect `/week`

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/week/page.tsx`

**Interfaces:**
- Consumes: `FluidDayWeek` from `@/components/fluid-day-week` (Task 1); `listDailyTasksByDate`, `toggleDailyTask` from `@/lib/actions/dailyTasks`; `listWeeklyGoalsForCurrentWeek`, `getWeekProgress` from `@/lib/actions/weeklyGoals`; `redirect` from `next/navigation`.

Neither file has an existing test (matching the precedent set by `layout.tsx` in Phase 1 — no test for root-level page composition in this codebase). Verified manually in Task 4.

- [ ] **Step 1: Replace `src/app/page.tsx`**

Replace the full contents of `src/app/page.tsx`:

```tsx
import { listDailyTasksByDate, toggleDailyTask } from '@/lib/actions/dailyTasks'
import { getWeekProgress, listWeeklyGoalsForCurrentWeek } from '@/lib/actions/weeklyGoals'
import { FluidDayWeek } from '@/components/fluid-day-week'

// This page's correctness depends on the wall clock at request time (it
// filters tasks by "today" and computes "the current week" from `new
// Date()`), not just on data changes, so it must never be statically
// prerendered — otherwise it freezes on the build day/week forever.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const tasks = await listDailyTasksByDate(new Date())
  const goals = await listWeeklyGoalsForCurrentWeek()
  const progress = await Promise.all(goals.map((g) => getWeekProgress(g.id)))

  return (
    <main className="mx-auto max-w-2xl p-8">
      <FluidDayWeek tasks={tasks} goals={goals} progress={progress} onToggleTask={toggleDailyTask} />
    </main>
  )
}
```

- [ ] **Step 2: Replace `src/app/week/page.tsx` with a redirect**

Replace the full contents of `src/app/week/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function WeekPage() {
  redirect('/')
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx src/app/week/page.tsx
git commit -m "feat: merge Semana into the fluid Hoje view, redirect /week to /"
```

---

### Task 3: Remove the `Semana` sidebar entry

**Files:**
- Modify: `src/components/sidebar.tsx`
- Modify: `src/components/sidebar.test.tsx`

**Interfaces:**
- No change to `Sidebar`'s exported signature (`export function Sidebar(): JSX.Element`, no props) or to `isLinkActive`'s logic — only the `links` array shrinks from 3 entries to 2.

- [ ] **Step 1: Update the failing/changed tests first**

Replace the full contents of `src/components/sidebar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))

describe('Sidebar', () => {
  it('renders links to Hoje and Objetivos, and no longer a Semana link', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: /hoje/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /objetivos/i })).toHaveAttribute('href', '/objectives')
    expect(screen.queryByRole('link', { name: /semana/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('marks the link matching the current route as active', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: /hoje/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /objetivos/i })).not.toHaveAttribute('aria-current')
  })

  it('marks Objetivos as active for nested objective routes', () => {
    vi.mocked(usePathname).mockReturnValue('/objectives/123/weeks/456')
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: /objetivos/i })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark Objetivos active on the home route', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: /objetivos/i })).not.toHaveAttribute('aria-current')
  })

  it('provides accessible names for mobile navigation links', () => {
    vi.mocked(usePathname).mockReturnValue('/')
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: 'Hoje' })).toHaveAttribute('aria-label', 'Hoje')
    expect(screen.getByRole('link', { name: 'Objetivos' })).toHaveAttribute('aria-label', 'Objetivos')
  })

  it('does not match routes with shared prefixes (path boundary safety)', () => {
    vi.mocked(usePathname).mockReturnValue('/objectives-archive')
    render(<Sidebar />)

    expect(screen.getByRole('link', { name: /objetivos/i })).not.toHaveAttribute('aria-current')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/sidebar.test.tsx`
Expected: FAIL — specifically the first test ("renders links to Hoje and Objetivos, and no longer a Semana link"), because the current `Sidebar` still renders a `Semana` link: `screen.queryByRole('link', { name: /semana/i })` will find it (failing the `.not.toBeInTheDocument()` assertion), and `getAllByRole('link')` will return 3 elements, not 2. The other five tests are expected to still pass unchanged — they never asserted on `Semana`'s absence.

- [ ] **Step 3: Update the `Sidebar` component**

In `src/components/sidebar.tsx`:
1. Change the import line from `import { CalendarDays, Sun, Target } from 'lucide-react'` to `import { Sun, Target } from 'lucide-react'`.
2. Remove the `{ href: '/week', label: 'Semana', icon: CalendarDays },` line from the `links` array, leaving:

```tsx
const links = [
  { href: '/', label: 'Hoje', icon: Sun },
  { href: '/objectives', label: 'Objetivos', icon: Target },
]
```

Nothing else in the file changes.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/sidebar.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar.tsx src/components/sidebar.test.tsx
git commit -m "feat: remove Semana sidebar entry now that it's merged into Hoje"
```

---

### Task 4: Full test suite + manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: All tests pass, including the 5 new `fluid-day-week.test.tsx` tests, the updated `sidebar.test.tsx` (6 tests), and every other pre-existing test (no regressions — nothing else references `/week` as a page, and `dailyTasks`/`weeklyGoals` action tests don't touch the pages).

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`

- [ ] **Step 3: Manually verify in a browser**

Open the app and check, per this project's convention of verifying UI changes in a real browser before calling them done:

- `/` shows today's tasks, collapsed, with a "Ver semana ⌄" button below them.
- Clicking the button smoothly expands to reveal "Esta semana" with the current week's goals and progress bars; the button now reads "Recolher semana ⌃".
- Clicking again smoothly collapses it back; reloading the page always starts collapsed again (no persistence).
- Checking a task's checkbox in the "Hoje" section still marks it complete (and, since `revalidatePath('/')` already fires from `toggleDailyTask`, the change should be reflected without a manual reload).
- Visiting `/week` directly redirects to `/`.
- The sidebar now shows only 2 items (Hoje, Objetivos) on both desktop (hover-expanded rail) and mobile (bottom bar) — no leftover "Semana" entry or broken layout from the missing third item.
- Test with at least one objective that has a weekly goal with daily tasks due today, so both the "Hoje" and expanded "Esta semana" sections have real content to check spacing/wrapping.

- [ ] **Step 4: Stop the dev server**

Fix anything found during manual verification before considering this plan complete; do not commit further unless a fix was needed.
