# Lifetime Progress Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a number on the home page that only ever grows — the lifetime count of completed tasks, plus a forgiving week-by-week constancy indicator — reading from the `DailyTask.completedAt` column that is written on every toggle today and never read anywhere in `src/`.

**Architecture:** A pure bucketing function (`src/lib/stats.ts`) turns a flat list of completion timestamps into an ordered window of weeks flagged active/inactive, using `getWeekBounds` as the single authority on where a week starts. A thin server action (`src/lib/actions/stats.ts`) runs three narrow Prisma queries and hands their output to that function. A presentational Server Component renders the result as a full-width strip above the existing two-column layout in `page.tsx`.

**Tech Stack:** Next.js 16 (App Router, Server Components, Server Actions), Prisma 6 + Postgres, Tailwind v4 with tokens from `globals.css`, shadcn/ui on Base UI, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-19-progresso-acumulado-e-retomada-design.md`

## Global Constraints

- **Never introduce a second week-start convention.** `getWeekBounds` (`src/lib/dates.ts:3`, `startOfWeek(date, { weekStartsOn: 1 })`) is the only place that decides when a week begins. Do not use `date_trunc('week', …)`, raw SQL, or any hand-rolled Monday calculation.
- **No schema change and no migration.** Every column read here already exists.
- Style only with existing design tokens (`bg-accent`, `border-primary`, `text-primary`, `text-muted-foreground`, `bg-muted`). No hardcoded hex colors and no new inline styles — this matches every component in `src/components/`.
- Dates render as `dd/MM/yyyy` or `dd/MM` via `date-fns` `format`, matching `weekly-goal-card.tsx:114` and `progress.ts:18`. Do **not** add a `date-fns/locale` import — the codebase has no locale usage and this feature does not justify introducing one.
- All UI copy is Portuguese (pt-BR), matching the rest of the app.
- Tests: Vitest + Testing Library, plain fixture objects, `vi.fn()` only — no mocking framework. DB-touching tests hit the real `metas_app_test` database; `src/test/setup.ts` truncates all three tables after every test.
- Run a single file with `npx vitest run <path>`, the full suite with `npm test`. The test DB must be up (`docker compose up -d`) and migrated (`npm run test:migrate`).
- **`'use server'` files may only export async functions.** Types are erased at compile time and are fine to export; plain synchronous helpers must stay unexported.

---

### Task 1: Pure week-window bucketing

**Files:**
- Create: `src/lib/stats.ts`
- Test: `src/lib/stats.test.ts`

**Interfaces:**
- Produces: `export type WeekWindowEntry = { weekStart: Date; active: boolean }`
- Produces: `export type LifetimeStats = { totalCompleted: number; firstCompletedAt: Date | null; weekWindow: WeekWindowEntry[] }`
- Produces: `export function buildWeekWindow(completedAts: Date[], now: Date, maxWeeks?: number): WeekWindowEntry[]`

`LifetimeStats` lives in this pure module rather than in the `'use server'` action module (Task 2) so the React component in Task 3 can import it without the type crossing a server-action boundary.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/stats.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildWeekWindow } from '@/lib/stats'

// Dates use the local-time constructor `new Date(year, monthIndex, day, …)`
// rather than ISO strings on purpose: `new Date('2026-08-17')` parses as UTC
// midnight, which lands on Aug 16 in any negative-offset timezone and would
// make these week-boundary assertions pass or fail depending on where the
// suite runs. Month index is 0-based, so 7 is August.
//
// Reference calendar: 2026-08-19 is a Wednesday, so the current week starts
// Monday 2026-08-17. Earlier Mondays: 08-10, 08-03, 07-27, …, 06-29.
const NOW = new Date(2026, 7, 19, 12)

describe('buildWeekWindow', () => {
  it('returns an empty window when nothing has ever been completed', () => {
    expect(buildWeekWindow([], NOW)).toEqual([])
  })

  it('returns a single active week when the only completion is in the current week', () => {
    const window = buildWeekWindow([new Date(2026, 7, 18, 9)], NOW)

    expect(window).toHaveLength(1)
    expect(window[0].weekStart).toEqual(new Date(2026, 7, 17))
    expect(window[0].active).toBe(true)
  })

  it('spans from the earliest completion to the current week, oldest first, marking gaps inactive', () => {
    const window = buildWeekWindow(
      [
        new Date(2026, 7, 4, 10), // Tuesday of the week of 08-03
        new Date(2026, 7, 18, 10), // Tuesday of the week of 08-17
      ],
      NOW,
    )

    expect(window.map((w) => w.weekStart)).toEqual([
      new Date(2026, 7, 3),
      new Date(2026, 7, 10),
      new Date(2026, 7, 17),
    ])
    // Nothing was completed in the week of 08-10 — it is a gap, not a break.
    expect(window.map((w) => w.active)).toEqual([true, false, true])
  })

  it('caps the window at maxWeeks, keeping the most recent weeks', () => {
    const window = buildWeekWindow([new Date(2026, 0, 5, 10)], NOW, 8)

    expect(window).toHaveLength(8)
    expect(window[0].weekStart).toEqual(new Date(2026, 5, 29)) // 7 weeks before 08-17
    expect(window[7].weekStart).toEqual(new Date(2026, 7, 17))
    // The January completion falls outside the capped window entirely.
    expect(window.every((w) => !w.active)).toBe(true)
  })

  it('splits Sunday 23:59 and Monday 00:00 into different weeks', () => {
    const sundayNight = new Date(2026, 7, 16, 23, 59) // last minute of the week of 08-10
    const mondayMorning = new Date(2026, 7, 17, 0, 0) // first minute of the week of 08-17

    const window = buildWeekWindow([sundayNight, mondayMorning], NOW)

    expect(window.map((w) => w.weekStart)).toEqual([new Date(2026, 7, 10), new Date(2026, 7, 17)])
    expect(window.map((w) => w.active)).toEqual([true, true])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/stats.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/stats"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/stats.ts`:

```ts
import { addWeeks, isWithinInterval, max, min } from 'date-fns'
import { getWeekBounds } from '@/lib/dates'

export type WeekWindowEntry = { weekStart: Date; active: boolean }

export type LifetimeStats = {
  totalCompleted: number
  firstCompletedAt: Date | null
  weekWindow: WeekWindowEntry[]
}

const DEFAULT_MAX_WEEKS = 8

/**
 * Buckets completion timestamps into consecutive weeks, oldest first.
 *
 * The window is adaptive, not fixed: it starts at the week of the earliest
 * completion and is only clamped to `maxWeeks` when history runs longer than
 * that. Someone two weeks into using the app sees two dots, not eight with six
 * unlit — which would read as failure to a user who has done nothing wrong.
 */
export function buildWeekWindow(
  completedAts: Date[],
  now: Date,
  maxWeeks: number = DEFAULT_MAX_WEEKS,
): WeekWindowEntry[] {
  if (completedAts.length === 0) return []

  const currentWeekStart = getWeekBounds(now).weekStart
  const earliestWeekStart = getWeekBounds(min(completedAts)).weekStart
  const cappedStart = addWeeks(currentWeekStart, -(maxWeeks - 1))
  // Clamped on both sides: never earlier than the cap, never later than the
  // current week (which a clock-skewed future timestamp could otherwise force).
  const windowStart = min([max([earliestWeekStart, cappedStart]), currentWeekStart])

  const entries: WeekWindowEntry[] = []
  for (let weekStart = windowStart; weekStart <= currentWeekStart; weekStart = addWeeks(weekStart, 1)) {
    const { weekEnd } = getWeekBounds(weekStart)
    entries.push({
      weekStart,
      active: completedAts.some((completedAt) =>
        isWithinInterval(completedAt, { start: weekStart, end: weekEnd }),
      ),
    })
  }

  return entries
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/stats.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats.ts src/lib/stats.test.ts
git commit -m "feat: add pure week-window bucketing for lifetime stats"
```

---

### Task 2: `getLifetimeStats` server action

**Files:**
- Create: `src/lib/actions/stats.ts`
- Test: `src/lib/actions/stats.test.ts`

**Interfaces:**
- Consumes: `buildWeekWindow`, `LifetimeStats` from `@/lib/stats` (Task 1); `getWeekBounds` from `@/lib/dates`; `prisma` from `@/lib/db`
- Produces: `export async function getLifetimeStats(): Promise<LifetimeStats>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/actions/stats.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { getLifetimeStats } from '@/lib/actions/stats'
import { getWeekBounds } from '@/lib/dates'

async function makeGoal() {
  const objective = await prisma.objective.create({
    data: { title: 'Obj', startDate: new Date() },
  })
  const bounds = getWeekBounds(new Date())
  return prisma.weeklyGoal.create({
    data: { title: 'Goal', objectiveId: objective.id, ...bounds },
  })
}

describe('getLifetimeStats', () => {
  it('returns an empty result for an empty database', async () => {
    expect(await getLifetimeStats()).toEqual({
      totalCompleted: 0,
      firstCompletedAt: null,
      weekWindow: [],
    })
  })

  it('counts only completed tasks', async () => {
    const goal = await makeGoal()
    const now = new Date()
    await prisma.dailyTask.createMany({
      data: [
        { title: 'A', weeklyGoalId: goal.id, date: now, completed: true, completedAt: now },
        { title: 'B', weeklyGoalId: goal.id, date: now, completed: true, completedAt: now },
        { title: 'C', weeklyGoalId: goal.id, date: now, completed: false },
      ],
    })

    const stats = await getLifetimeStats()

    expect(stats.totalCompleted).toBe(2)
  })

  it('reports the earliest completion timestamp', async () => {
    const goal = await makeGoal()
    const older = new Date(2026, 6, 29, 8)
    const newer = new Date(2026, 7, 18, 8)
    await prisma.dailyTask.createMany({
      data: [
        { title: 'Newer', weeklyGoalId: goal.id, date: newer, completed: true, completedAt: newer },
        { title: 'Older', weeklyGoalId: goal.id, date: older, completed: true, completedAt: older },
      ],
    })

    const stats = await getLifetimeStats()

    expect(stats.firstCompletedAt).toEqual(older)
  })

  it('counts a completed task with a null completedAt in the total but leaves it out of the window', async () => {
    // Only reachable by writing to the DB directly — `toggleDailyTask` always
    // sets `completed` and `completedAt` together. Such a row cannot be placed
    // in a week, so it is deliberately excluded from the window rather than
    // treated as an error.
    const goal = await makeGoal()
    const now = new Date()
    await prisma.dailyTask.createMany({
      data: [
        { title: 'Orphan', weeklyGoalId: goal.id, date: now, completed: true, completedAt: null },
        { title: 'Normal', weeklyGoalId: goal.id, date: now, completed: true, completedAt: now },
      ],
    })

    const stats = await getLifetimeStats()

    expect(stats.totalCompleted).toBe(2)
    expect(stats.weekWindow).toHaveLength(1)
    expect(stats.weekWindow[0].active).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/actions/stats.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/actions/stats"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/actions/stats.ts`:

```ts
'use server'

import { addWeeks } from 'date-fns'
import { prisma } from '@/lib/db'
import { getWeekBounds } from '@/lib/dates'
import { buildWeekWindow, type LifetimeStats } from '@/lib/stats'

const WINDOW_WEEKS = 8

export async function getLifetimeStats(): Promise<LifetimeStats> {
  const now = new Date()
  const windowStart = addWeeks(getWeekBounds(now).weekStart, -(WINDOW_WEEKS - 1))

  const [totalCompleted, first, recent] = await Promise.all([
    prisma.dailyTask.count({ where: { completed: true } }),
    prisma.dailyTask.findFirst({
      where: { completed: true, completedAt: { not: null } },
      orderBy: { completedAt: 'asc' },
      select: { completedAt: true },
    }),
    prisma.dailyTask.findMany({
      where: { completed: true, completedAt: { gte: windowStart } },
      select: { completedAt: true },
    }),
  ])

  // `completedAt: { gte: … }` already excludes nulls in SQL, but Prisma still
  // types the column as `Date | null`, so narrow it for `buildWeekWindow`.
  const completedAts = recent
    .map((task) => task.completedAt)
    .filter((completedAt): completedAt is Date => completedAt !== null)

  return {
    totalCompleted,
    firstCompletedAt: first?.completedAt ?? null,
    weekWindow: buildWeekWindow(completedAts, now, WINDOW_WEEKS),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/actions/stats.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/stats.ts src/lib/actions/stats.test.ts
git commit -m "feat: add getLifetimeStats server action"
```

---

### Task 3: `LifetimeProgressBanner` component

**Files:**
- Create: `src/components/lifetime-progress-banner.tsx`
- Test: `src/components/lifetime-progress-banner.test.tsx`

**Interfaces:**
- Consumes: `LifetimeStats` from `@/lib/stats` (Task 1); `cn` from `@/lib/utils`
- Produces: `export function LifetimeProgressBanner(props: LifetimeStats): JSX.Element`

No `'use client'` — this renders no interactivity and stays a Server Component.

- [ ] **Step 1: Write the failing tests**

Create `src/components/lifetime-progress-banner.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LifetimeProgressBanner } from '@/components/lifetime-progress-banner'

const week = (monthIndex: number, day: number, active: boolean) => ({
  weekStart: new Date(2026, monthIndex, day),
  active,
})

describe('LifetimeProgressBanner', () => {
  it('shows the lifetime count and the date of the first completion', () => {
    render(
      <LifetimeProgressBanner
        totalCompleted={247}
        firstCompletedAt={new Date(2026, 6, 29, 10)}
        weekWindow={[week(7, 17, true)]}
      />,
    )

    expect(screen.getByText('247')).toBeInTheDocument()
    expect(screen.getByText(/tarefas concluídas desde 29\/07\/2026/)).toBeInTheDocument()
  })

  it('uses the singular form for a single completed task', () => {
    render(
      <LifetimeProgressBanner
        totalCompleted={1}
        firstCompletedAt={new Date(2026, 7, 18, 10)}
        weekWindow={[week(7, 17, true)]}
      />,
    )

    expect(screen.getByText(/tarefa concluída desde 18\/08\/2026/)).toBeInTheDocument()
  })

  it('renders one dot per week, marking active weeks apart from inactive ones', () => {
    render(
      <LifetimeProgressBanner
        totalCompleted={12}
        firstCompletedAt={new Date(2026, 7, 3, 10)}
        weekWindow={[week(7, 3, true), week(7, 10, false), week(7, 17, true)]}
      />,
    )

    const dots = screen.getAllByTestId('week-dot')

    expect(dots).toHaveLength(3)
    expect(dots.map((dot) => dot.getAttribute('data-active'))).toEqual(['true', 'false', 'true'])
  })

  it('summarises how many of the windowed weeks were active', () => {
    render(
      <LifetimeProgressBanner
        totalCompleted={12}
        firstCompletedAt={new Date(2026, 7, 3, 10)}
        weekWindow={[week(7, 3, true), week(7, 10, false), week(7, 17, true)]}
      />,
    )

    expect(screen.getByText('2 das últimas 3 semanas')).toBeInTheDocument()
  })

  it('greets a first-week user instead of showing a one-week ratio', () => {
    render(
      <LifetimeProgressBanner
        totalCompleted={3}
        firstCompletedAt={new Date(2026, 7, 18, 10)}
        weekWindow={[week(7, 17, true)]}
      />,
    )

    expect(screen.getByText('Sua primeira semana')).toBeInTheDocument()
    expect(screen.queryByText(/das últimas/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/lifetime-progress-banner.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/lifetime-progress-banner"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/lifetime-progress-banner.tsx`:

```tsx
import { format } from 'date-fns'
import type { LifetimeStats } from '@/lib/stats'
import { cn } from '@/lib/utils'

export function LifetimeProgressBanner({ totalCompleted, firstCompletedAt, weekWindow }: LifetimeStats) {
  const activeWeeks = weekWindow.filter((week) => week.active).length

  return (
    <section
      aria-label="Progresso acumulado"
      className="mb-6 flex flex-col gap-3 rounded-lg border border-primary bg-accent px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-primary">{totalCompleted}</span>
        <span className="text-sm text-muted-foreground">
          {totalCompleted === 1 ? 'tarefa concluída' : 'tarefas concluídas'}
          {firstCompletedAt ? ` desde ${format(firstCompletedAt, 'dd/MM/yyyy')}` : ''}
        </span>
      </p>

      {weekWindow.length > 0 && (
        <div className="flex items-center gap-2">
          {/* The dots are decorative: the sibling label carries the same
              information as text, so screen readers get it once, not twice. */}
          <div className="flex gap-1" aria-hidden="true">
            {weekWindow.map((week) => (
              <span
                key={week.weekStart.toISOString()}
                data-testid="week-dot"
                data-active={week.active}
                title={`Semana de ${format(week.weekStart, 'dd/MM')}`}
                className={cn('size-2 rounded-full', week.active ? 'bg-primary' : 'bg-muted')}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {weekWindow.length === 1
              ? 'Sua primeira semana'
              : `${activeWeeks} das últimas ${weekWindow.length} semanas`}
          </span>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/lifetime-progress-banner.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/lifetime-progress-banner.tsx src/components/lifetime-progress-banner.test.tsx
git commit -m "feat: add LifetimeProgressBanner component"
```

---

### Task 4: Render the banner on the home page

**Files:**
- Modify: `src/app/page.tsx:1-19` (whole file)

**Interfaces:**
- Consumes: `getLifetimeStats` from `@/lib/actions/stats` (Task 2); `LifetimeProgressBanner` from `@/components/lifetime-progress-banner` (Task 3)
- Produces: nothing new — this is the integration point

This task has no automated test. `src/app/` contains no page-level tests today and this plan does not introduce a page-testing setup for a four-line change; verification is the full suite staying green plus a manual check with real data (Step 3).

- [ ] **Step 1: Rewrite `src/app/page.tsx`**

```tsx
import { listDailyTasksByDate, toggleDailyTask } from '@/lib/actions/dailyTasks'
import { getLifetimeStats } from '@/lib/actions/stats'
import { listWeeklyGoalsForCurrentWeek } from '@/lib/actions/weeklyGoals'
import { FluidDayWeek } from '@/components/fluid-day-week'
import { LifetimeProgressBanner } from '@/components/lifetime-progress-banner'

// This page's correctness depends on the wall clock at request time (it
// filters tasks by "today" and computes "the current week" from `new
// Date()`), so it must never be statically prerendered — otherwise it freezes on the build day/week forever.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const tasks = await listDailyTasksByDate(new Date())
  const goals = await listWeeklyGoalsForCurrentWeek()
  const stats = await getLifetimeStats()

  return (
    <main className="mx-auto max-w-2xl p-8 lg:max-w-6xl">
      {/* Full-width, above the two-column layout rather than inside either
          column: the right column collapses into an accordion below `lg`, and
          the accumulated total has to stay visible on a phone — that is the
          screen a returning user opens. */}
      {stats.totalCompleted > 0 && <LifetimeProgressBanner {...stats} />}
      <FluidDayWeek tasks={tasks} goals={goals} onToggleTask={toggleDailyTask} />
    </main>
  )
}
```

- [ ] **Step 2: Run the full suite and the linter**

```bash
npm test
npm run lint
```

Expected: all tests pass, no lint errors.

- [ ] **Step 3: Verify manually against real data**

```bash
docker compose up -d
npm run dev
```

Open `http://localhost:3000` and confirm:
- With no completed tasks, no banner renders at all.
- After checking off one task in "Hoje", the banner appears with `1 tarefa concluída desde <hoje>` and `Sua primeira semana`.
- The banner spans the full width above both columns at `lg`+ and stays visible on a narrow viewport (below `1024px`), where "Progresso da semana" collapses behind "Ver semana".

- [ ] **Step 4: Verify the production build**

```bash
npm run build
```

Expected: build succeeds. `/` must still be reported as dynamic, not statically prerendered.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: show lifetime progress banner on the home page"
```

---

## Verification

Full check after all four tasks:

```bash
npm test          # every test file, sequentially against metas_app_test
npm run lint
npm run build
```

## Notes for the executor

- **Do not** compute weeks with `date_trunc` in SQL, even though the aggregate query would be faster. The spec rejects it: Postgres's week convention would become a second source of truth that has to be manually kept in sync with `weekStartsOn: 1`.
- The banner intentionally has no "streak" of consecutive days. Weeks-with-activity was chosen precisely because the visible reset to zero of a daily streak is the moment users abandon a habit app.
- If a test fails on a machine in a non-UTC timezone, the cause is almost certainly an ISO date string somewhere (`new Date('2026-08-17')`). Use the local-time constructor instead.
