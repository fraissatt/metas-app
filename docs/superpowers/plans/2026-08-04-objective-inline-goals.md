# Objetivo como Tela de Gerência Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/objectives/[id]` a self-contained management screen where weekly goals and daily tasks (including tasks recurring across multiple days of a week) are created inline, with no navigation to separate creation pages; and make the objective title link on `/objectives` visually obvious as a link.

**Architecture:** `/objectives/[id]/page.tsx` stays a Server Component; a new client component tree (`WeeklyGoalsPanel` → `WeeklyGoalCard` + `AddWeeklyGoalCard`) receives server-fetched data as props and owns only UI state (which card is expanded, whether the add-goal form is open), following the exact "server fetches, thin client wrapper owns interactivity" pattern already used by `fluid-day-week.tsx`. Mutations go through existing Server Actions (`createWeeklyGoal`, `deleteWeeklyGoal`) plus one new one (`createDailyTasks`, which creates N independent `DailyTask` rows — one per day selected in a 7-day toggle strip). No Prisma schema changes.

**Tech Stack:** Next.js 16.2.12 (App Router, Server Actions), React 19.2.4, Prisma 6 + Postgres, Tailwind CSS v4, shadcn components on `@base-ui/react`, Recharts, `date-fns`, Vitest + React Testing Library.

## Global Constraints

- npm only — never yarn/pnpm/bun (per `AGENTS.md`/`README.md`).
- Next.js 16.2.12 conventions may differ from training data — this plan's Server Action / App Router usage is grounded in the actual existing code (`src/lib/actions/*.ts`, `src/app/objectives/**`), not assumptions.
- No new npm dependencies — `recharts`, `date-fns`, `@base-ui/react`, `lucide-react` are already installed and cover everything needed.
- Tests run against a real Postgres test database (`npm run test:migrate` then `npm test`), never mocked Prisma. `next/cache`'s `revalidatePath`/`revalidateTag` are mocked globally in `src/test/setup.ts`, which also truncates `dailyTask` → `weeklyGoal` → `objective` after every test — no per-test cleanup needed.
- Week boundaries are always Monday-start (`startOfWeek`/`endOfWeek` with `{ weekStartsOn: 1 }`) — matches the existing `getWeekBounds` in `src/lib/dates.ts`.
- A recurring task is N independent `DailyTask` rows (same `title`/`weeklyGoalId`, different `date`), never a shared "recurrence group" — editing/deleting/completing one must never affect the others. No schema/migration change.
- Prisma model shapes (exact fields, no more/less) per `prisma/schema.prisma`:
  - `WeeklyGoal`: `id, title, objectiveId, weekStart, weekEnd, status` (no `dailyTasks` unless explicitly `include`d)
  - `DailyTask`: `id, title, weeklyGoalId, date, completed, completedAt`
- Dark-theme colors are consumed only via the existing CSS-variable-backed Tailwind tokens (`bg-primary`, `text-muted-foreground`, `border-border`, `bg-accent`, `text-accent-foreground`, etc.) — never hardcoded hex values — per the sidebar visual-identity spec already shipped.
- The dedicated weekly-goal page (`/objectives/[id]/weeks/[weekId]`) and task edit page are unchanged by this plan — they remain the place to toggle/edit/delete individual tasks.

---

### Task 1: `getWeekDays` date helper

**Files:**
- Modify: `src/lib/dates.ts`
- Test: `src/lib/dates.test.ts`

**Interfaces:**
- Produces: `export function getWeekDays(weekStart: Date): Date[]` — returns exactly 7 `Date`s, Monday through Sunday, starting from `weekStart`. Consumed by Task 6 (`WeeklyGoalCard`) and Task 5 (`WeeklyGoalDayChart`).

- [ ] **Step 1: Write the failing test**

Add to `src/lib/dates.test.ts` (append a new `describe` block after the existing `getWeekBounds` one):

```ts
import { describe, expect, it } from 'vitest'
import { getWeekBounds, getWeekDays } from '@/lib/dates'

// ... existing getWeekBounds describe block stays unchanged above ...

describe('getWeekDays', () => {
  it('returns the 7 dates from Monday through Sunday', () => {
    const monday = new Date('2026-07-27T00:00:00')

    const days = getWeekDays(monday)

    expect(days).toHaveLength(7)
    expect(days[0].getDate()).toBe(27) // Mon Jul 27
    expect(days[1].getDate()).toBe(28) // Tue Jul 28
    expect(days[6].getDate()).toBe(2) // Sun Aug 2
  })
})
```

(Only add the `getWeekDays` import and the new `describe` block — the file's existing `getWeekBounds` tests and imports stay as they are.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: FAIL — `getWeekDays` is not exported from `@/lib/dates` yet.

- [ ] **Step 3: Implement `getWeekDays`**

In `src/lib/dates.ts`, change the import line and add the new function:

```ts
import { addDays, endOfWeek, startOfWeek } from 'date-fns'

export function getWeekBounds(date: Date): { weekStart: Date; weekEnd: Date } {
  return {
    weekStart: startOfWeek(date, { weekStartsOn: 1 }),
    weekEnd: endOfWeek(date, { weekStartsOn: 1 }),
  }
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: PASS (existing `getWeekBounds` tests + new `getWeekDays` test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts
git commit -m "feat: add getWeekDays helper for per-day breakdowns"
```

---

### Task 2: Revalidate the objective page from every daily-task action

**Files:**
- Modify: `src/lib/actions/dailyTasks.ts`
- Test: `src/lib/actions/dailyTasks.test.ts`

**Interfaces:**
- No exported signatures change. `revalidateWeekPath` (private helper) gains one more `revalidatePath` call; every existing daily-task action that calls it (`createDailyTask`, `updateDailyTask`, `toggleDailyTask`, `deleteDailyTask`) benefits automatically.

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('daily task actions', ...)` block in `src/lib/actions/dailyTasks.test.ts` (place it right after the `'creates a daily task from form data'` test):

```ts
  it('also revalidates the objective detail page', async () => {
    const goal = await makeWeeklyGoal()

    await createDailyTask(goal.id, formData({ title: 'Correr 5km', date: '2026-07-29' }))

    expect(revalidatePath).toHaveBeenCalledWith(`/objectives/${goal.objectiveId}`)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/actions/dailyTasks.test.ts`
Expected: FAIL on the new test — `revalidatePath` was never called with `/objectives/${goal.objectiveId}`.

- [ ] **Step 3: Extend `revalidateWeekPath`**

In `src/lib/actions/dailyTasks.ts`, change `revalidateWeekPath`:

```ts
async function revalidateWeekPath(weeklyGoalId: string): Promise<void> {
  const goal = await prisma.weeklyGoal.findUnique({
    where: { id: weeklyGoalId },
    select: { objectiveId: true },
  })
  if (goal) {
    revalidatePath(`/objectives/${goal.objectiveId}/weeks/${weeklyGoalId}`)
    // The objective detail page now also renders live weekly-goal/task data
    // inline (quick-add, progress, expanded per-day view), so it needs the
    // same revalidation as the weekly goal's own page.
    revalidatePath(`/objectives/${goal.objectiveId}`)
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/actions/dailyTasks.test.ts`
Expected: PASS (all existing tests plus the new one — existing `toHaveBeenCalledWith` assertions for the weekly-goal path still pass unchanged since `toHaveBeenCalledWith` only checks that call happened at least once, not that it's the only call).

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/dailyTasks.ts src/lib/actions/dailyTasks.test.ts
git commit -m "feat: revalidate the objective page from daily task actions"
```

---

### Task 3: `createDailyTasks` action (multi-day / recurring creation)

**Files:**
- Modify: `src/lib/actions/dailyTasks.ts`
- Test: `src/lib/actions/dailyTasks.test.ts`

**Interfaces:**
- Produces: `export async function createDailyTasks(weeklyGoalId: string, formData: FormData): Promise<void>`. Reads a single `title` field and every value of a repeated `dates` field (`formData.getAll('dates')`, each a `yyyy-MM-dd` string). Creates one independent `DailyTask` per date. Throws if `title` is empty (via existing `readTitle`) or if zero dates are provided. Consumed by Task 9 (`/objectives/[id]/page.tsx`, passed to `WeeklyGoalsPanel`).

- [ ] **Step 1: Write the failing tests**

First, update the existing named-import list at the top of `src/lib/actions/dailyTasks.test.ts` to also include `createDailyTasks`:

```ts
import {
  createDailyTask,
  createDailyTasks,
  deleteDailyTask,
  getDailyTask,
  listDailyTasksByDate,
  listDailyTasksByWeeklyGoal,
  toggleDailyTask,
  updateDailyTask,
} from '@/lib/actions/dailyTasks'
```

Then add this helper and `describe` block to the end of the file (keep the existing `formData`/`makeWeeklyGoal` helpers and the existing `describe('daily task actions', ...)` block exactly as they are; add this new block after it):

```ts
function multiFormData(title: string, dates: string[]) {
  const fd = new FormData()
  fd.set('title', title)
  for (const d of dates) fd.append('dates', d)
  return fd
}

describe('createDailyTasks (recurring)', () => {
  it('creates one independent daily task per selected date', async () => {
    const goal = await makeWeeklyGoal()

    await createDailyTasks(goal.id, multiFormData('Alongamento', ['2026-07-28', '2026-07-30']))

    const tasks = await prisma.dailyTask.findMany({ orderBy: { date: 'asc' } })
    expect(tasks).toHaveLength(2)
    expect(tasks.map((t) => t.title)).toEqual(['Alongamento', 'Alongamento'])
    expect(tasks[0].date.getDate()).toBe(28)
    expect(tasks[1].date.getDate()).toBe(30)
    expect(revalidatePath).toHaveBeenCalledWith(`/objectives/${goal.objectiveId}`)
    expect(revalidatePath).toHaveBeenCalledWith(`/objectives/${goal.objectiveId}/weeks/${goal.id}`)
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('rejects when no day is selected', async () => {
    const goal = await makeWeeklyGoal()

    await expect(createDailyTasks(goal.id, multiFormData('Alongamento', []))).rejects.toThrow()
    expect(await prisma.dailyTask.findMany()).toHaveLength(0)
  })

  it('rejects an empty title', async () => {
    const goal = await makeWeeklyGoal()

    await expect(createDailyTasks(goal.id, multiFormData('  ', ['2026-07-28']))).rejects.toThrow()
    expect(await prisma.dailyTask.findMany()).toHaveLength(0)
  })

  it('completing one recurring instance does not affect the others', async () => {
    const goal = await makeWeeklyGoal()
    await createDailyTasks(goal.id, multiFormData('Alongamento', ['2026-07-28', '2026-07-30']))
    const [first, second] = await prisma.dailyTask.findMany({ orderBy: { date: 'asc' } })

    await toggleDailyTask(first.id)

    expect((await prisma.dailyTask.findUnique({ where: { id: first.id } }))?.completed).toBe(true)
    expect((await prisma.dailyTask.findUnique({ where: { id: second.id } }))?.completed).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/actions/dailyTasks.test.ts`
Expected: FAIL — `createDailyTasks` is not exported from `@/lib/actions/dailyTasks` yet.

- [ ] **Step 3: Implement `createDailyTasks`**

In `src/lib/actions/dailyTasks.ts`, add `parseISO` to the existing `date-fns` import and add the new action (after `createDailyTask`):

```ts
import { endOfDay, parseISO, startOfDay } from 'date-fns'
```

```ts
export async function createDailyTasks(weeklyGoalId: string, formData: FormData): Promise<void> {
  const title = readTitle(formData)
  const rawDates = formData.getAll('dates').map(String)
  if (rawDates.length === 0) {
    throw new Error('Selecione ao menos um dia')
  }

  const dates = rawDates.map((raw) => {
    const date = parseISO(raw)
    if (Number.isNaN(date.getTime())) {
      throw new Error('"dates" must contain valid dates')
    }
    return date
  })

  await prisma.dailyTask.createMany({
    data: dates.map((date) => ({ title, date, weeklyGoalId })),
  })
  await revalidateWeekPath(weeklyGoalId)
  revalidatePath('/')
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/actions/dailyTasks.test.ts`
Expected: PASS (all tests, old and new)

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/dailyTasks.ts src/lib/actions/dailyTasks.test.ts
git commit -m "feat: add createDailyTasks action for recurring multi-day tasks"
```

---

### Task 4: Include daily tasks when listing weekly goals by objective

**Files:**
- Modify: `src/lib/actions/weeklyGoals.ts`
- Test: `src/lib/actions/weeklyGoals.test.ts`

**Interfaces:**
- Produces: `export type WeeklyGoalWithTasks = WeeklyGoal & { dailyTasks: DailyTask[] }` and changes `listWeeklyGoalsByObjective`'s return type from `Promise<WeeklyGoal[]>` to `Promise<WeeklyGoalWithTasks[]>`. `dailyTasks` are ordered by `date` ascending. Consumed by Task 6, 8, 9 (`WeeklyGoalCard`, `WeeklyGoalsPanel`, `/objectives/[id]/page.tsx`).
- Confirmed by codebase search that `listWeeklyGoalsByObjective` has exactly one other call site (`src/app/objectives/[id]/page.tsx`, itself rewritten in Task 9) plus its own test — safe to widen its return shape.

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('weekly goal actions', ...)` block in `src/lib/actions/weeklyGoals.test.ts`, right after the `'lists weekly goals for an objective ordered by week start'` test:

```ts
  it("includes each goal's daily tasks ordered by date", async () => {
    const objective = await makeObjective()
    const bounds = getWeekBounds(new Date('2026-07-29'))
    const goal = await prisma.weeklyGoal.create({
      data: { title: 'Goal', objectiveId: objective.id, ...bounds },
    })
    const later = await prisma.dailyTask.create({
      data: { title: 'Later', weeklyGoalId: goal.id, date: new Date('2026-07-30') },
    })
    const earlier = await prisma.dailyTask.create({
      data: { title: 'Earlier', weeklyGoalId: goal.id, date: new Date('2026-07-28') },
    })

    const [result] = await listWeeklyGoalsByObjective(objective.id)

    expect(result.dailyTasks.map((t) => t.id)).toEqual([earlier.id, later.id])
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`
Expected: FAIL — TypeScript/runtime error, `result.dailyTasks` is `undefined` (the query doesn't `include` it yet).

- [ ] **Step 3: Extend `listWeeklyGoalsByObjective`**

In `src/lib/actions/weeklyGoals.ts`, change the type import and the function:

```ts
import type { DailyTask, WeeklyGoal } from '@prisma/client'

export type WeeklyGoalWithTasks = WeeklyGoal & { dailyTasks: DailyTask[] }
```

```ts
export async function listWeeklyGoalsByObjective(objectiveId: string): Promise<WeeklyGoalWithTasks[]> {
  return prisma.weeklyGoal.findMany({
    where: { objectiveId },
    orderBy: { weekStart: 'asc' },
    include: { dailyTasks: { orderBy: { date: 'asc' } } },
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`
Expected: PASS (all existing tests plus the new one)

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/weeklyGoals.ts src/lib/actions/weeklyGoals.test.ts
git commit -m "feat: include daily tasks when listing weekly goals by objective"
```

---

### Task 5: `WeeklyGoalDayChart` component

**Files:**
- Create: `src/components/weekly-goal-day-chart.tsx`

No test file for this component — matches the existing, untested `src/components/objective-progress-chart.tsx` (Recharts' `ResponsiveContainer` measures zero width/height under jsdom, so this codebase verifies chart components manually in the browser instead of via Testing Library; confirmed by `objective-progress-chart.tsx` having no `.test.tsx` file). Verified manually in Task 10.

**Interfaces:**
- Produces: `export function WeeklyGoalDayChart({ weekStart, tasks }: { weekStart: Date; tasks: DailyTask[] }): JSX.Element`. Consumed by Task 6 (`WeeklyGoalCard`).
- Consumes: `getWeekDays` from `@/lib/dates` (Task 1).

- [ ] **Step 1: Create the component**

Create `src/components/weekly-goal-day-chart.tsx`:

```tsx
'use client'

import { isSameDay } from 'date-fns'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DailyTask } from '@prisma/client'
import { getWeekDays } from '@/lib/dates'

const DAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

export function WeeklyGoalDayChart({ weekStart, tasks }: { weekStart: Date; tasks: DailyTask[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem tarefas nesta semana ainda.</p>
  }

  const data = getWeekDays(weekStart).map((day, index) => {
    const dayTasks = tasks.filter((t) => isSameDay(t.date, day))
    return {
      label: DAY_LABELS[index],
      completed: dayTasks.filter((t) => t.completed).length,
      remaining: dayTasks.filter((t) => !t.completed).length,
    }
  })

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="label"
          stroke="var(--muted-foreground)"
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
        />
        <YAxis
          allowDecimals={false}
          stroke="var(--muted-foreground)"
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--popover)',
            borderColor: 'var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--popover-foreground)',
          }}
        />
        <Bar dataKey="completed" stackId="day" fill="var(--primary)" />
        <Bar dataKey="remaining" stackId="day" fill="var(--muted)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/weekly-goal-day-chart.tsx
git commit -m "feat: add WeeklyGoalDayChart per-day completion chart"
```

---

### Task 6: `WeeklyGoalCard` component

**Files:**
- Create: `src/components/weekly-goal-card.tsx`
- Test: `src/components/weekly-goal-card.test.tsx`

**Interfaces:**
- Consumes: `WeeklyGoalWithTasks` type (`@/lib/actions/weeklyGoals`, Task 4), `getWeekDays` (`@/lib/dates`, Task 1), `WeeklyGoalDayChart` (`@/components/weekly-goal-day-chart`, Task 5), `Button`/`Card`/`CardHeader`/`CardTitle`/`CardContent`/`Input`/`Progress` (existing `ui/` components), `DeleteButton` (`@/components/delete-button`, signature `{ action: () => Promise<void>; confirmDescription?: string }`), `Checkbox` primitive from `@base-ui/react/checkbox`.
- Produces: `export function WeeklyGoalCard(props: { goal: WeeklyGoalWithTasks; expanded: boolean; onToggleExpand: () => void; onCreateTasks: (formData: FormData) => Promise<void>; onDelete: () => Promise<void> }): JSX.Element`. Consumed by Task 8 (`WeeklyGoalsPanel`).
- Day toggles are real checkboxes (`name="dates"`, `value` = `yyyy-MM-dd`), each with an explicit `aria-label` of `"${3-letter day} ${day-of-month number}"` (e.g. `"TER 28"`) — base UI's checkbox role does not derive its accessible name from visible child content, so the label must be explicit for both accessibility and test queries.
- Preserves the existing "Editar" (link to `/objectives/[id]/weeks/[weekId]/edit`) and "Excluir" (`DeleteButton`) controls that were on the objective page's goal cards before this change — this plan relocates them into `WeeklyGoalCard`, it does not remove them.

- [ ] **Step 1: Write the failing tests**

Create `src/components/weekly-goal-card.test.tsx`:

```tsx
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
  weekStart: new Date('2026-07-27'), // Monday
  weekEnd: new Date('2026-08-02'),
  status: 'ACTIVE',
  dailyTasks: [
    {
      id: 'task-1',
      title: 'Testar toggle',
      weeklyGoalId: 'goal-1',
      date: new Date('2026-07-28'),
      completed: true,
      completedAt: new Date('2026-07-28'),
    },
    {
      id: 'task-2',
      title: 'Testar criação',
      weeklyGoalId: 'goal-1',
      date: new Date('2026-07-29'),
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

    expect(screen.getByRole('link', { name: /editar/i })).toHaveAttribute(
      'href',
      '/objectives/obj-1/weeks/goal-1/edit',
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/weekly-goal-card.test.tsx`
Expected: FAIL — `Cannot find module '@/components/weekly-goal-card'`.

- [ ] **Step 3: Implement `WeeklyGoalCard`**

Create `src/components/weekly-goal-card.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { format, isSameDay } from 'date-fns'
import type { DailyTask } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DeleteButton } from '@/components/delete-button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { WeeklyGoalDayChart } from '@/components/weekly-goal-day-chart'
import { getWeekDays } from '@/lib/dates'
import type { WeeklyGoalWithTasks } from '@/lib/actions/weeklyGoals'

const DAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

function computeProgress(tasks: DailyTask[]): { total: number; completed: number; percent: number } {
  const total = tasks.length
  const completed = tasks.filter((t) => t.completed).length
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  return { total, completed, percent }
}

export function WeeklyGoalCard({
  goal,
  expanded,
  onToggleExpand,
  onCreateTasks,
  onDelete,
}: {
  goal: WeeklyGoalWithTasks
  expanded: boolean
  onToggleExpand: () => void
  onCreateTasks: (formData: FormData) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const days = getWeekDays(goal.weekStart)
  const today = new Date()
  const { total, completed, percent } = computeProgress(goal.dailyTasks)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>
          <Link href={`/objectives/${goal.objectiveId}/weeks/${goal.id}`}>{goal.title}</Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Progress value={percent} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {completed}/{total} tarefas ({percent}%)
          </span>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              size="sm"
              nativeButton={false}
              render={<Link href={`/objectives/${goal.objectiveId}/weeks/${goal.id}/edit`} />}
            >
              Editar
            </Button>
            <DeleteButton
              action={onDelete}
              confirmDescription="Isso também excluirá todas as tarefas diárias desta meta. Esta ação não pode ser desfeita."
            />
          </div>
        </div>

        <form action={onCreateTasks} className="flex flex-col gap-2">
          <Input name="title" placeholder="Nova tarefa" required />
          <div className="flex gap-1.5">
            {days.map((day, index) => {
              const iso = format(day, 'yyyy-MM-dd')
              const label = `${DAY_LABELS[index]} ${format(day, 'd')}`
              return (
                <CheckboxPrimitive.Root
                  key={iso}
                  name="dates"
                  value={iso}
                  defaultChecked={isSameDay(day, today)}
                  aria-label={label}
                  className="flex flex-1 flex-col items-center justify-center rounded-md border border-border bg-secondary px-1 py-1.5 text-[11px] text-muted-foreground transition-colors data-checked:border-primary data-checked:bg-accent data-checked:text-accent-foreground"
                >
                  <span aria-hidden="true">{DAY_LABELS[index]}</span>
                  <span aria-hidden="true" className="font-medium">
                    {format(day, 'd')}
                  </span>
                </CheckboxPrimitive.Root>
              )
            })}
          </div>
          <Button type="submit" size="sm" className="self-end">
            Criar
          </Button>
        </form>

        <Button type="button" variant="ghost" size="sm" onClick={onToggleExpand} aria-expanded={expanded}>
          {expanded ? 'ver menos ▴' : 'ver detalhes ▾'}
        </Button>

        {expanded && (
          <div className="flex flex-col gap-3 border-t border-border pt-3">
            <WeeklyGoalDayChart weekStart={goal.weekStart} tasks={goal.dailyTasks} />
            {goal.dailyTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tarefa nesta semana.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {goal.dailyTasks.map((task) => (
                  <li
                    key={task.id}
                    className={`text-sm ${task.completed ? 'text-muted-foreground line-through' : ''}`}
                  >
                    {format(task.date, 'dd/MM')} · {task.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/weekly-goal-card.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/weekly-goal-card.tsx src/components/weekly-goal-card.test.tsx
git commit -m "feat: add WeeklyGoalCard with inline quick-add and expandable detail view"
```

---

### Task 7: `AddWeeklyGoalCard` component

**Files:**
- Create: `src/components/add-weekly-goal-card.tsx`
- Test: `src/components/add-weekly-goal-card.test.tsx`

**Interfaces:**
- Consumes: `WeeklyGoalForm` (`@/components/weekly-goal-form`, existing, signature `{ action: (formData: FormData) => Promise<void>; defaultValues?: { title: string; weekOf: string } }`), `Button`/`Card`/`CardContent`.
- Produces: `export function AddWeeklyGoalCard(props: { onCreate: (formData: FormData) => Promise<void> }): JSX.Element`. Consumed by Task 8 (`WeeklyGoalsPanel`).

- [ ] **Step 1: Write the failing tests**

Create `src/components/add-weekly-goal-card.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddWeeklyGoalCard } from '@/components/add-weekly-goal-card'

describe('AddWeeklyGoalCard', () => {
  it('shows the dashed "+" trigger by default', () => {
    render(<AddWeeklyGoalCard onCreate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /nova meta semanal/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/título/i)).not.toBeInTheDocument()
  })

  it('reveals the weekly goal form when clicked', async () => {
    render(<AddWeeklyGoalCard onCreate={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /nova meta semanal/i }))

    expect(screen.getByLabelText(/título/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/semana de/i)).toBeInTheDocument()
  })

  it('submits through onCreate and collapses back to the trigger', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<AddWeeklyGoalCard onCreate={onCreate} />)
    await userEvent.click(screen.getByRole('button', { name: /nova meta semanal/i }))

    await userEvent.type(screen.getByLabelText(/título/i), 'Cobrir fluxo de metas')
    await userEvent.type(screen.getByLabelText(/semana de/i), '2026-08-03')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    expect(onCreate).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: /nova meta semanal/i })).toBeInTheDocument()
  })

  it('cancels back to the trigger without calling onCreate', async () => {
    const onCreate = vi.fn()
    render(<AddWeeklyGoalCard onCreate={onCreate} />)
    await userEvent.click(screen.getByRole('button', { name: /nova meta semanal/i }))

    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(screen.getByRole('button', { name: /nova meta semanal/i })).toBeInTheDocument()
    expect(onCreate).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/add-weekly-goal-card.test.tsx`
Expected: FAIL — `Cannot find module '@/components/add-weekly-goal-card'`.

- [ ] **Step 3: Implement `AddWeeklyGoalCard`**

Create `src/components/add-weekly-goal-card.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { WeeklyGoalForm } from '@/components/weekly-goal-form'

export function AddWeeklyGoalCard({ onCreate }: { onCreate: (formData: FormData) => Promise<void> }) {
  const [adding, setAdding] = useState(false)

  if (!adding) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setAdding(true)}
        className="h-auto w-full border-dashed border-primary py-4 text-primary hover:bg-primary/10 hover:text-primary"
      >
        + Nova meta semanal
      </Button>
    )
  }

  async function handleCreate(formData: FormData) {
    await onCreate(formData)
    setAdding(false)
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <WeeklyGoalForm action={handleCreate} />
        <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
          Cancelar
        </Button>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/add-weekly-goal-card.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/add-weekly-goal-card.tsx src/components/add-weekly-goal-card.test.tsx
git commit -m "feat: add AddWeeklyGoalCard inline creation card"
```

---

### Task 8: `WeeklyGoalsPanel` component

**Files:**
- Create: `src/components/weekly-goals-panel.tsx`
- Test: `src/components/weekly-goals-panel.test.tsx`

**Interfaces:**
- Consumes: `WeeklyGoalCard` (Task 6), `AddWeeklyGoalCard` (Task 7), `WeeklyGoalWithTasks` type (`@/lib/actions/weeklyGoals`, Task 4).
- Produces: `export function WeeklyGoalsPanel(props: { goals: WeeklyGoalWithTasks[]; onCreateTasks: (weeklyGoalId: string, formData: FormData) => Promise<void>; onCreateWeeklyGoal: (formData: FormData) => Promise<void>; onDeleteWeeklyGoal: (weeklyGoalId: string) => Promise<void> }): JSX.Element`. Consumed by Task 9 (`/objectives/[id]/page.tsx`).
- Deliberately receives `onCreateTasks`/`onDeleteWeeklyGoal` as generic `(id, ...)` functions rather than importing `createDailyTasks`/`deleteWeeklyGoal` itself, and closes over each `goal.id` internally when calling them — this keeps the component DB-free and testable with plain `vi.fn()` props, matching every other client component in this codebase (`TaskToggle`, `DeleteButton`, `WeeklyGoalForm`). Only one card is expanded at a time.

- [ ] **Step 1: Write the failing tests**

Create `src/components/weekly-goals-panel.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/weekly-goals-panel.test.tsx`
Expected: FAIL — `Cannot find module '@/components/weekly-goals-panel'`.

- [ ] **Step 3: Implement `WeeklyGoalsPanel`**

Create `src/components/weekly-goals-panel.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { AddWeeklyGoalCard } from '@/components/add-weekly-goal-card'
import { WeeklyGoalCard } from '@/components/weekly-goal-card'
import type { WeeklyGoalWithTasks } from '@/lib/actions/weeklyGoals'

export function WeeklyGoalsPanel({
  goals,
  onCreateTasks,
  onCreateWeeklyGoal,
  onDeleteWeeklyGoal,
}: {
  goals: WeeklyGoalWithTasks[]
  onCreateTasks: (weeklyGoalId: string, formData: FormData) => Promise<void>
  onCreateWeeklyGoal: (formData: FormData) => Promise<void>
  onDeleteWeeklyGoal: (weeklyGoalId: string) => Promise<void>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      {goals.map((goal) => (
        <WeeklyGoalCard
          key={goal.id}
          goal={goal}
          expanded={expandedId === goal.id}
          onToggleExpand={() => setExpandedId((current) => (current === goal.id ? null : goal.id))}
          onCreateTasks={(formData) => onCreateTasks(goal.id, formData)}
          onDelete={() => onDeleteWeeklyGoal(goal.id)}
        />
      ))}
      <AddWeeklyGoalCard onCreate={onCreateWeeklyGoal} />
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/weekly-goals-panel.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/weekly-goals-panel.tsx src/components/weekly-goals-panel.test.tsx
git commit -m "feat: add WeeklyGoalsPanel composing goal cards and add-goal card"
```

---

### Task 9: Wire `/objectives/[id]` to the new panel, remove the standalone "new weekly goal" page

**Files:**
- Modify: `src/app/objectives/[id]/page.tsx`
- Delete: `src/app/objectives/[id]/weeks/new/page.tsx` (and the now-empty `weeks/new/` directory)

**Interfaces:**
- Consumes: `WeeklyGoalsPanel` (Task 8), `createDailyTasks` (Task 3), `listWeeklyGoalsByObjective` (Task 4), existing `createWeeklyGoal`/`deleteWeeklyGoal` (`@/lib/actions/weeklyGoals`), existing `getObjective` (`@/lib/actions/objectives`), existing `getObjectiveProgressSeries` (`@/lib/actions/progress`), existing `ObjectiveProgressChart`.
- No test file for this page (matches the existing precedent — no Next.js page in this codebase has its own `.test.tsx`; page composition is verified manually). Verified manually in Task 10.

- [ ] **Step 1: Rewrite the objective detail page**

Replace the full contents of `src/app/objectives/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getObjective } from '@/lib/actions/objectives'
import { getObjectiveProgressSeries } from '@/lib/actions/progress'
import { createDailyTasks } from '@/lib/actions/dailyTasks'
import { createWeeklyGoal, deleteWeeklyGoal, listWeeklyGoalsByObjective } from '@/lib/actions/weeklyGoals'
import { ObjectiveProgressChart } from '@/components/objective-progress-chart'
import { WeeklyGoalsPanel } from '@/components/weekly-goals-panel'

export default async function ObjectiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const objective = await getObjective(id)
  if (!objective) notFound()

  const weeklyGoals = await listWeeklyGoalsByObjective(id)
  const series = await getObjectiveProgressSeries(id)

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold break-words">{objective.title}</h1>
      <div className="mb-6">
        <ObjectiveProgressChart data={series} />
      </div>
      <WeeklyGoalsPanel
        goals={weeklyGoals}
        onCreateTasks={createDailyTasks}
        onCreateWeeklyGoal={createWeeklyGoal.bind(null, id)}
        onDeleteWeeklyGoal={deleteWeeklyGoal}
      />
    </main>
  )
}
```

- [ ] **Step 2: Delete the standalone "new weekly goal" route**

Delete the file `src/app/objectives/[id]/weeks/new/page.tsx`, then remove the now-empty `src/app/objectives/[id]/weeks/new/` directory.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — no test referenced the deleted page or the old inline card markup on this page (confirmed: no `.test.tsx` exists for any page under `src/app/objectives/`).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors (in particular, confirms nothing else still imports the deleted page or expects `listWeeklyGoalsByObjective`'s old `WeeklyGoal[]` return type).

- [ ] **Step 5: Commit**

```bash
git add -A src/app/objectives/[id]/page.tsx src/app/objectives/[id]/weeks/new
git commit -m "feat: make the objective page the primary place to create goals and tasks"
```

---

### Task 10: Visible link affordance on the objectives list

**Files:**
- Modify: `src/app/objectives/page.tsx`

**Interfaces:** none (styling-only change, no new props/exports).

- [ ] **Step 1: Add the hover affordance class**

In `src/app/objectives/page.tsx`, change:

```tsx
<Link href={`/objectives/${objective.id}`}>{objective.title}</Link>
```

to:

```tsx
<Link href={`/objectives/${objective.id}`} className="transition-colors hover:text-primary hover:underline">
  {objective.title}
</Link>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/objectives/page.tsx
git commit -m "fix: make the objective title link visually discoverable"
```

---

### Task 11: Full test suite + manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: All tests pass — every task's new tests plus every pre-existing test (no regressions).

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: No errors.

- [ ] **Step 3: Start the dev server**

Run: `npm run dev`

- [ ] **Step 4: Manually verify in a browser**

Open the app and check, per this project's convention of verifying UI changes in a real browser before calling the work done:

- `/objectives` — objective titles now visibly look like links (color change + underline) on hover.
- Open an objective with no weekly goals yet: only the dashed "+ Nova meta semanal" card shows. Click it, fill in title + week, save — a new goal card appears, no page navigation happened.
- On a goal card: type a task title, leave "today" pre-checked (or pick other days too), click "Criar" — the task appears in "Hoje" (`/`) and in the card's progress count, without navigating away.
- Check multiple days at once and create — confirm in "ver detalhes" that separate task entries were created for each day, and that completing one (via the dedicated weekly-goal page) doesn't complete the others.
- Click "ver detalhes" on a card — the per-day chart and read-only task list appear; no checkbox/delete controls are present there. Click "ver detalhes" on a second card — the first one collapses automatically.
- "Editar" and "Excluir" on a goal card still work exactly as before (edit page loads with correct defaults; delete asks for confirmation and removes the goal and its tasks).
- Visit `/objectives/[id]/weeks/new` directly (typed URL) — confirm it now 404s.
- Test with an objective that has 2+ weekly goals, each with several tasks across different days of the week, to check spacing/wrapping with real content (reuse or extend the seed data from earlier in this conversation if still present in the dev database).

- [ ] **Step 5: Stop the dev server**

Fix anything found during manual verification before considering this plan complete; do not commit further unless a fix was needed.
