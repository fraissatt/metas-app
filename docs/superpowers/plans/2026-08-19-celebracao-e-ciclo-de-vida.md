# Celebration and Objective Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mark the moment a weekly goal is fulfilled, let an objective be completed and kept as proof, and give each objective an accumulated record — weeks fulfilled and tasks completed — so a multi-year objective shows what has been built.

**Architecture:** One pure module (`src/lib/objectives.ts`) owns the two rules everything else derives from: when a goal counts as fulfilled, and how a week's goals aggregate into a single fulfilled/unfulfilled verdict. Server actions read rows and delegate to it; components read props and delegate to it. The existing `getObjectiveProgressSeries` is rebuilt on the same aggregation, which fixes its duplicate-label defect on the way past.

**Tech Stack:** Next.js 16 (App Router, Server Components, Server Actions), Prisma 6 + Postgres, Tailwind v4 with tokens from `globals.css`, shadcn/ui on Base UI, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-19-celebracao-e-ciclo-de-vida-design.md`

## Global Constraints

- **Fulfilment is derived, never stored.** `WeeklyGoal.status` stays unwritten by this work. A goal is fulfilled when `dailyTasks.length > 0 && every task completed` — the `length > 0` half is mandatory everywhere, or an unplanned goal celebrates itself.
- **`isGoalFulfilled` is the only place that rule lives.** Components and actions call it; nobody re-implements `completed === total`.
- **`getWeekBounds`** (`src/lib/dates.ts:3`, `weekStartsOn: 1`) stays the authority on week boundaries. Any week arithmetic uses `date-fns` with `{ weekStartsOn: 1 }` to match.
- Style only with existing design tokens (`bg-accent`, `border-primary`, `border-border`, `text-primary`, `text-primary-foreground`, `text-muted-foreground`). No hardcoded colors.
- Buttons that navigate use `<Button nativeButton={false} render={<Link href="…" />}>` (see `src/app/objectives/page.tsx:15`).
- All UI copy is Portuguese (pt-BR). Dates render via `date-fns` `format` as `dd/MM` or `dd/MM/yyyy` — no `date-fns/locale` import.
- Tests: Vitest + Testing Library, plain fixtures, `vi.fn()` only. DB tests hit `metas_app_test`; `src/test/setup.ts` truncates all three tables after each test.
- Run a single file with `npx vitest run <path>`, the full suite with `npm test`. Test DB must be up (`docker compose up -d`) and migrated (`npm run test:migrate`).
- **`'use server'` files may only export async functions.** Types may be exported; synchronous helpers must stay unexported.
- **Naming note (deviation from the spec):** the component in `src/components/objective-stats.tsx` is called `ObjectiveStatsPanel`, because `ObjectiveStats` is already the type name and `<ObjectiveStats stats={…} />` reads badly.

---

### Task 1: Pure objective rules

**Files:**
- Create: `src/lib/objectives.ts`
- Test: `src/lib/objectives.test.ts`

**Interfaces:**
- Produces: `export function isGoalFulfilled(dailyTasks: Array<{ completed: boolean }>): boolean`
- Produces: `export type ObjectiveWeek = { weekStart: Date; total: number; completed: number; fulfilled: boolean }`
- Produces: `export function buildObjectiveWeeks(goals: Array<{ weekStart: Date; dailyTasks: Array<{ completed: boolean }> }>): ObjectiveWeek[]`
- Produces: `export type ObjectiveStats = { weeksFulfilled: number; tasksCompleted: number; weeksSinceStart: number; recentWeeks: ObjectiveWeek[] }`
- Produces: `export function describeSchedule(completedAt: Date, targetDate: Date | null): string | null`

The input types are declared structurally rather than importing `WeeklyGoalWithTasks` from `@/lib/actions/weeklyGoals`: that module is `'use server'`, and a pure module should not reach into it. Structural typing means the real Prisma rows satisfy it anyway.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/objectives.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildObjectiveWeeks, describeSchedule, isGoalFulfilled } from '@/lib/objectives'

// Local-time constructor, not ISO strings: `new Date('2026-08-17')` is UTC
// midnight, which lands on Aug 16 in any negative-offset timezone. Month index
// is 0-based, so 7 is August.
const week = (monthIndex: number, day: number) => new Date(2026, monthIndex, day)
const task = (completed: boolean) => ({ completed })

describe('isGoalFulfilled', () => {
  it('is true when every task is complete', () => {
    expect(isGoalFulfilled([task(true), task(true)])).toBe(true)
  })

  it('is false when any task is incomplete', () => {
    expect(isGoalFulfilled([task(true), task(false)])).toBe(false)
  })

  it('is false for a goal with no tasks at all', () => {
    // `every` on an empty array is vacuously true — a goal nobody planned
    // must not celebrate itself.
    expect(isGoalFulfilled([])).toBe(false)
  })
})

describe('buildObjectiveWeeks', () => {
  it('returns an empty list for no goals', () => {
    expect(buildObjectiveWeeks([])).toEqual([])
  })

  it('collapses several goals in the same week into one entry with summed totals', () => {
    const weeks = buildObjectiveWeeks([
      { weekStart: week(7, 17), dailyTasks: [task(true), task(false)] },
      { weekStart: week(7, 17), dailyTasks: [task(true)] },
    ])

    expect(weeks).toHaveLength(1)
    expect(weeks[0].total).toBe(3)
    expect(weeks[0].completed).toBe(2)
  })

  it('fulfils a week only when every goal in it is fulfilled', () => {
    const [mixed] = buildObjectiveWeeks([
      { weekStart: week(7, 17), dailyTasks: [task(true)] },
      { weekStart: week(7, 17), dailyTasks: [task(true), task(false)] },
    ])
    expect(mixed.fulfilled).toBe(false)

    const [all] = buildObjectiveWeeks([
      { weekStart: week(7, 17), dailyTasks: [task(true)] },
      { weekStart: week(7, 17), dailyTasks: [task(true), task(true)] },
    ])
    expect(all.fulfilled).toBe(true)
  })

  it('does not fulfil a week that holds a goal with no tasks', () => {
    const [entry] = buildObjectiveWeeks([
      { weekStart: week(7, 17), dailyTasks: [task(true)] },
      { weekStart: week(7, 17), dailyTasks: [] },
    ])

    expect(entry.fulfilled).toBe(false)
  })

  it('returns weeks oldest first regardless of input order', () => {
    const weeks = buildObjectiveWeeks([
      { weekStart: week(7, 17), dailyTasks: [task(true)] },
      { weekStart: week(7, 3), dailyTasks: [task(true)] },
      { weekStart: week(7, 10), dailyTasks: [task(false)] },
    ])

    expect(weeks.map((w) => w.weekStart)).toEqual([week(7, 3), week(7, 10), week(7, 17)])
    expect(weeks.map((w) => w.fulfilled)).toEqual([true, false, true])
  })
})

describe('describeSchedule', () => {
  it('returns null when no target date was ever set', () => {
    expect(describeSchedule(week(8, 12), null)).toBeNull()
  })

  it('describes finishing ahead of the target', () => {
    expect(describeSchedule(week(7, 17), week(8, 7))).toBe('3 semanas antes do previsto')
  })

  it('describes finishing behind the target', () => {
    expect(describeSchedule(week(8, 7), week(7, 17))).toBe('3 semanas depois do previsto')
  })

  it('uses the singular for one week', () => {
    expect(describeSchedule(week(7, 17), week(7, 24))).toBe('1 semana antes do previsto')
  })

  it('describes landing in the target week', () => {
    expect(describeSchedule(week(7, 17), week(7, 19))).toBe('na semana prevista')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/objectives.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/objectives"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/objectives.ts`:

```ts
import { differenceInCalendarWeeks } from 'date-fns'

export type ObjectiveWeek = {
  weekStart: Date
  total: number
  completed: number
  fulfilled: boolean
}

export type ObjectiveStats = {
  weeksFulfilled: number
  tasksCompleted: number
  weeksSinceStart: number
  recentWeeks: ObjectiveWeek[]
}

type GoalLike = { weekStart: Date; dailyTasks: Array<{ completed: boolean }> }

/**
 * The single definition of a fulfilled weekly goal, used by the celebration in
 * the UI and by the per-objective week aggregation below — one concept, so the
 * number a user reads on `/objectives/[id]` means the same thing as the badge
 * they saw on the home page.
 *
 * The emptiness check is load-bearing: `[].every(…)` is `true`, so without it a
 * goal that was never given any tasks would report itself fulfilled.
 */
export function isGoalFulfilled(dailyTasks: Array<{ completed: boolean }>): boolean {
  return dailyTasks.length > 0 && dailyTasks.every((task) => task.completed)
}

/**
 * Collapses an objective's weekly goals into one entry per week, oldest first.
 * A week is fulfilled when every goal it held was fulfilled — one goal closed
 * and another left at 2/3 is not a week the user accomplished.
 */
export function buildObjectiveWeeks(goals: GoalLike[]): ObjectiveWeek[] {
  const byWeek = new Map<string, ObjectiveWeek>()

  for (const goal of goals) {
    const key = goal.weekStart.toISOString()
    const total = goal.dailyTasks.length
    const completed = goal.dailyTasks.filter((task) => task.completed).length
    const fulfilled = isGoalFulfilled(goal.dailyTasks)
    const entry = byWeek.get(key)

    if (entry) {
      entry.total += total
      entry.completed += completed
      entry.fulfilled = entry.fulfilled && fulfilled
    } else {
      byWeek.set(key, { weekStart: goal.weekStart, total, completed, fulfilled })
    }
  }

  return [...byWeek.values()].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
}

/** How the completion landed against the objective's own target, if it set one. */
export function describeSchedule(completedAt: Date, targetDate: Date | null): string | null {
  if (!targetDate) return null

  const weeks = differenceInCalendarWeeks(targetDate, completedAt, { weekStartsOn: 1 })
  if (weeks === 0) return 'na semana prevista'

  const magnitude = Math.abs(weeks)
  const unit = magnitude === 1 ? 'semana' : 'semanas'
  return `${magnitude} ${unit} ${weeks > 0 ? 'antes' : 'depois'} do previsto`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/objectives.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/objectives.ts src/lib/objectives.test.ts
git commit -m "feat: add pure objective fulfilment rules"
```

---

### Task 2: Rebuild `getObjectiveProgressSeries` per week

**Files:**
- Modify: `src/lib/actions/progress.ts` (whole file)
- Test: `src/lib/actions/progress.test.ts`

**Interfaces:**
- Consumes: `buildObjectiveWeeks` from `@/lib/objectives` (Task 1)
- Produces: `getObjectiveProgressSeries` keeps its existing signature, `(objectiveId: string) => Promise<Array<{ weekLabel: string; percent: number }>>`

The current implementation maps over weekly **goals**, so two goals in one week emit two bars with the same `dd/MM` label. It also runs one `getWeekProgress` query per goal; aggregating in memory removes that loop entirely. `ObjectiveProgressChart` is untouched — its contract does not change.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/actions/progress.test.ts`, inside the existing `describe('getObjectiveProgressSeries', …)` block, and rename the existing case from `'returns one point per weekly goal, ordered by week, with completion percent'` to `'returns one point per week, ordered by week, with completion percent'`:

```ts
  it('emits one point per week when an objective has several goals in the same week', async () => {
    const objective = await prisma.objective.create({ data: { title: 'Obj', startDate: new Date() } })
    const week = getWeekBounds(parseISO('2026-07-06'))

    const first = await prisma.weeklyGoal.create({
      data: { title: 'Primeira', objectiveId: objective.id, ...week },
    })
    const second = await prisma.weeklyGoal.create({
      data: { title: 'Segunda', objectiveId: objective.id, ...week },
    })
    await prisma.dailyTask.createMany({
      data: [
        { title: 'a', weeklyGoalId: first.id, date: week.weekStart, completed: true },
        { title: 'b', weeklyGoalId: first.id, date: week.weekStart, completed: true },
        { title: 'c', weeklyGoalId: second.id, date: week.weekStart, completed: false },
        { title: 'd', weeklyGoalId: second.id, date: week.weekStart, completed: false },
      ],
    })

    const series = await getObjectiveProgressSeries(objective.id)

    // One bar, not two with identical labels; the percent spans both goals.
    expect(series).toEqual([{ weekLabel: '06/07', percent: 50 }])
  })

  it('reports 0% for a week whose goal has no tasks', async () => {
    const objective = await prisma.objective.create({ data: { title: 'Obj', startDate: new Date() } })
    const week = getWeekBounds(parseISO('2026-07-06'))
    await prisma.weeklyGoal.create({
      data: { title: 'Vazia', objectiveId: objective.id, ...week },
    })

    expect(await getObjectiveProgressSeries(objective.id)).toEqual([
      { weekLabel: '06/07', percent: 0 },
    ])
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/actions/progress.test.ts`
Expected: FAIL — the multi-goal case returns two entries (`[{ weekLabel: '06/07', percent: 100 }, { weekLabel: '06/07', percent: 0 }]`) instead of one.

- [ ] **Step 3: Write the implementation**

Replace the whole of `src/lib/actions/progress.ts`:

```ts
'use server'

import { format } from 'date-fns'
import { prisma } from '@/lib/db'
import { buildObjectiveWeeks } from '@/lib/objectives'

export async function getObjectiveProgressSeries(
  objectiveId: string,
): Promise<Array<{ weekLabel: string; percent: number }>> {
  const weeklyGoals = await prisma.weeklyGoal.findMany({
    where: { objectiveId },
    orderBy: { weekStart: 'asc' },
    include: { dailyTasks: { select: { completed: true } } },
  })

  // Aggregated per week rather than per goal: an objective with two goals in
  // one week used to emit two bars carrying the same `dd/MM` label. Doing it in
  // memory also drops the previous one-query-per-goal `getWeekProgress` loop.
  return buildObjectiveWeeks(weeklyGoals).map((week) => ({
    weekLabel: format(week.weekStart, 'dd/MM'),
    percent: week.total === 0 ? 0 : Math.round((week.completed / week.total) * 100),
  }))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/actions/progress.test.ts`
Expected: PASS, 3 tests — including the pre-existing case, unchanged apart from its name.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/progress.ts src/lib/actions/progress.test.ts
git commit -m "fix: aggregate objective progress per week, not per weekly goal"
```

---

### Task 3: `getObjectiveStats`

**Files:**
- Modify: `src/lib/actions/objectives.ts` (append after `getObjective`)
- Test: `src/lib/actions/objectives.test.ts`

**Interfaces:**
- Consumes: `buildObjectiveWeeks`, `ObjectiveStats` from `@/lib/objectives` (Task 1)
- Produces: `export async function getObjectiveStats(objectiveId: string): Promise<ObjectiveStats>`

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('objective actions', …)` block in `src/lib/actions/objectives.test.ts`. Add `getObjectiveStats` to the import list (lines 4-11), and widen the `date-fns` import on line 2 from `import { format } from 'date-fns'` to `import { addWeeks, format, parseISO } from 'date-fns'`:

```ts
  it('reports zeros for an objective with no weekly goals', async () => {
    const objective = await prisma.objective.create({
      data: { title: 'Academia', startDate: new Date() },
    })

    const stats = await getObjectiveStats(objective.id)

    expect(stats.weeksFulfilled).toBe(0)
    expect(stats.tasksCompleted).toBe(0)
    expect(stats.recentWeeks).toEqual([])
  })

  it('counts fulfilled weeks and completed tasks across weeks', async () => {
    const objective = await prisma.objective.create({
      data: { title: 'Academia', startDate: parseISO('2026-07-06') },
    })
    const fullWeek = getWeekBounds(parseISO('2026-07-06'))
    const partialWeek = getWeekBounds(parseISO('2026-07-13'))

    const full = await prisma.weeklyGoal.create({
      data: { title: 'Cheia', objectiveId: objective.id, ...fullWeek },
    })
    const partial = await prisma.weeklyGoal.create({
      data: { title: 'Parcial', objectiveId: objective.id, ...partialWeek },
    })
    await prisma.dailyTask.createMany({
      data: [
        { title: 'a', weeklyGoalId: full.id, date: fullWeek.weekStart, completed: true },
        { title: 'b', weeklyGoalId: full.id, date: fullWeek.weekStart, completed: true },
        { title: 'c', weeklyGoalId: partial.id, date: partialWeek.weekStart, completed: true },
        { title: 'd', weeklyGoalId: partial.id, date: partialWeek.weekStart, completed: false },
      ],
    })

    const stats = await getObjectiveStats(objective.id)

    expect(stats.weeksFulfilled).toBe(1)
    expect(stats.tasksCompleted).toBe(3)
    expect(stats.recentWeeks).toHaveLength(2)
  })

  it('measures weeks since the objective started', async () => {
    const objective = await prisma.objective.create({
      data: { title: 'Academia', startDate: addWeeks(new Date(), -5) },
    })

    expect((await getObjectiveStats(objective.id)).weeksSinceStart).toBe(5)
  })

  it('returns every week when there are fewer than 26, and the most recent 26 when there are more', async () => {
    const objective = await prisma.objective.create({
      data: { title: 'Academia', startDate: parseISO('2026-01-05') },
    })
    const firstWeekStart = getWeekBounds(parseISO('2026-01-05')).weekStart

    await prisma.weeklyGoal.createMany({
      data: Array.from({ length: 30 }, (_, i) => ({
        title: `Semana ${i}`,
        objectiveId: objective.id,
        ...getWeekBounds(addWeeks(firstWeekStart, i)),
      })),
    })

    const stats = await getObjectiveStats(objective.id)

    expect(stats.recentWeeks).toHaveLength(26)
    // The window keeps the newest weeks, so the oldest four fall off the front.
    expect(stats.recentWeeks[0].weekStart).toEqual(addWeeks(firstWeekStart, 4))
  })
```

Add `getWeekBounds` to the imports if not already present — the file currently imports `prisma` and the actions only, so add `import { getWeekBounds } from '@/lib/dates'`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/actions/objectives.test.ts`
Expected: FAIL — `getObjectiveStats is not a function`.

- [ ] **Step 3: Write the implementation**

Add `import { differenceInCalendarWeeks } from 'date-fns'` and `import { buildObjectiveWeeks, type ObjectiveStats } from '@/lib/objectives'` to `src/lib/actions/objectives.ts`, then append after `getObjective`:

```ts
const RECENT_WEEKS = 26

export async function getObjectiveStats(objectiveId: string): Promise<ObjectiveStats> {
  const objective = await prisma.objective.findUniqueOrThrow({
    where: { id: objectiveId },
    select: { startDate: true },
  })
  const goals = await prisma.weeklyGoal.findMany({
    where: { objectiveId },
    orderBy: { weekStart: 'asc' },
    include: { dailyTasks: { select: { completed: true } } },
  })

  const weeks = buildObjectiveWeeks(goals)

  return {
    weeksFulfilled: weeks.filter((week) => week.fulfilled).length,
    tasksCompleted: weeks.reduce((sum, week) => sum + week.completed, 0),
    // Calendar weeks crossed, not 7-day blocks, so this agrees with
    // `getWeekBounds` about where a week begins.
    weeksSinceStart: Math.max(
      0,
      differenceInCalendarWeeks(new Date(), objective.startDate, { weekStartsOn: 1 }),
    ),
    // The strip spans only the weeks this objective actually has. A four-week-old
    // objective shows four segments, not 26 with 22 blank — which would read as
    // failure to someone who has done nothing wrong.
    recentWeeks: weeks.slice(-RECENT_WEEKS),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/actions/objectives.test.ts`
Expected: PASS, existing cases plus the four new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/objectives.ts src/lib/actions/objectives.test.ts
git commit -m "feat: add getObjectiveStats"
```

---

### Task 4: `Objective.completedAt` and the complete/reopen actions

**Files:**
- Modify: `prisma/schema.prisma:10-19`
- Create: `prisma/migrations/<generated>/migration.sql` (produced by the Prisma CLI, not hand-written)
- Modify: `src/lib/actions/objectives.ts` (append after `getObjectiveStats`)
- Test: `src/lib/actions/objectives.test.ts`

**Interfaces:**
- Produces: `export async function completeObjective(id: string): Promise<void>`
- Produces: `export async function reopenObjective(id: string): Promise<void>`

The migration lives in this task rather than its own because it exists solely to serve these two actions.

- [ ] **Step 1: Add the column to the schema**

In `prisma/schema.prisma`, add one field to `model Objective`, after `status`:

```prisma
  completedAt DateTime?
```

`Status.COMPLETED` records *that* an objective finished; nothing records *when*, and the date is half of what makes it an achievement.

- [ ] **Step 2: Generate and apply the migration**

```bash
docker compose up -d
npx prisma migrate dev --name objective_completed_at
npm run test:migrate
```

Expected: a new folder under `prisma/migrations/` containing `ALTER TABLE "Objective" ADD COLUMN "completedAt" TIMESTAMP(3);`, applied to both the dev and test databases. The column is nullable, so no data step is needed and existing rows keep working.

- [ ] **Step 3: Write the failing tests**

Append inside the existing `describe('objective actions', …)` block, adding `completeObjective` and `reopenObjective` to the import list:

```ts
  it('completes an objective, recording when', async () => {
    const objective = await prisma.objective.create({
      data: { title: 'Correr 5km', startDate: new Date() },
    })

    await completeObjective(objective.id)

    const completed = await prisma.objective.findUniqueOrThrow({ where: { id: objective.id } })
    expect(completed.status).toBe('COMPLETED')
    expect(completed.completedAt).toBeInstanceOf(Date)
  })

  it('reopens a completed objective, clearing the completion date', async () => {
    const objective = await prisma.objective.create({
      data: {
        title: 'Correr 5km',
        startDate: new Date(),
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })

    await reopenObjective(objective.id)

    const reopened = await prisma.objective.findUniqueOrThrow({ where: { id: objective.id } })
    expect(reopened.status).toBe('ACTIVE')
    expect(reopened.completedAt).toBeNull()
  })

  it('leaves an already-completed objective completed', async () => {
    // Idempotent by construction — no guard needed, and none is used.
    const objective = await prisma.objective.create({
      data: { title: 'Correr 5km', startDate: new Date() },
    })

    await completeObjective(objective.id)
    await completeObjective(objective.id)

    const completed = await prisma.objective.findUniqueOrThrow({ where: { id: objective.id } })
    expect(completed.status).toBe('COMPLETED')
  })
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/lib/actions/objectives.test.ts`
Expected: FAIL — `completeObjective is not a function`.

- [ ] **Step 5: Write the implementation**

Append to `src/lib/actions/objectives.ts`:

```ts
// `status` and `completedAt` are always written together — COMPLETED with a
// timestamp, ACTIVE with null — so the two can never disagree.
export async function completeObjective(id: string): Promise<void> {
  await prisma.objective.update({
    where: { id },
    data: { status: 'COMPLETED', completedAt: new Date() },
  })
  revalidatePath('/objectives')
  revalidatePath(`/objectives/${id}`)
}

export async function reopenObjective(id: string): Promise<void> {
  await prisma.objective.update({
    where: { id },
    data: { status: 'ACTIVE', completedAt: null },
  })
  revalidatePath('/objectives')
  revalidatePath(`/objectives/${id}`)
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/actions/objectives.test.ts`
Expected: PASS, all cases.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/actions/objectives.ts src/lib/actions/objectives.test.ts
git commit -m "feat: let an objective be completed and reopened"
```

---

### Task 5: `listObjectivesWithStats`

**Files:**
- Modify: `src/lib/actions/objectives.ts` (append after `reopenObjective`)
- Test: `src/lib/actions/objectives.test.ts`

**Interfaces:**
- Consumes: `getObjectiveStats` (Task 3)
- Produces: `export type ObjectiveWithStats = Objective & { stats: ObjectiveStats }`
- Produces: `export async function listObjectivesWithStats(): Promise<{ active: ObjectiveWithStats[]; completed: ObjectiveWithStats[] }>`

`listObjectives` is left exactly as it is — other callers depend on it.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe` block, adding `listObjectivesWithStats` to the import list:

```ts
  it('splits objectives into active and completed, each carrying its stats', async () => {
    const active = await prisma.objective.create({
      data: { title: 'Em andamento', startDate: new Date() },
    })
    const done = await prisma.objective.create({
      data: {
        title: 'Terminado',
        startDate: new Date(),
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })

    const { active: activeList, completed } = await listObjectivesWithStats()

    expect(activeList.map((o) => o.id)).toEqual([active.id])
    expect(completed.map((o) => o.id)).toEqual([done.id])
    expect(activeList[0].stats.weeksFulfilled).toBe(0)
  })

  it('orders completed objectives by most recently completed', async () => {
    const older = await prisma.objective.create({
      data: {
        title: 'Antigo',
        startDate: new Date(),
        status: 'COMPLETED',
        completedAt: parseISO('2026-07-01'),
      },
    })
    const newer = await prisma.objective.create({
      data: {
        title: 'Recente',
        startDate: new Date(),
        status: 'COMPLETED',
        completedAt: parseISO('2026-08-01'),
      },
    })

    const { completed } = await listObjectivesWithStats()

    expect(completed.map((o) => o.id)).toEqual([newer.id, older.id])
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/actions/objectives.test.ts`
Expected: FAIL — `listObjectivesWithStats is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/actions/objectives.ts`:

```ts
export type ObjectiveWithStats = Objective & { stats: ObjectiveStats }

export async function listObjectivesWithStats(): Promise<{
  active: ObjectiveWithStats[]
  completed: ObjectiveWithStats[]
}> {
  const objectives = await prisma.objective.findMany({ orderBy: { createdAt: 'desc' } })

  // One stats query per objective, in parallel. This is N+1 by construction and
  // deliberately so: it keeps the week-fulfilment rule in `buildObjectiveWeeks`
  // instead of duplicating it into SQL, and follows the precedent already set by
  // `getObjectiveProgressSeries`. Revisit if objective counts reach the hundreds.
  const withStats = await Promise.all(
    objectives.map(async (objective) => ({
      ...objective,
      stats: await getObjectiveStats(objective.id),
    })),
  )

  return {
    // ABANDONED never occurs today (no screen writes it) and would land in
    // `active` if it ever did, which is the safer of the two buckets.
    active: withStats.filter((objective) => objective.status !== 'COMPLETED'),
    completed: withStats
      .filter((objective) => objective.status === 'COMPLETED')
      .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/actions/objectives.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/objectives.ts src/lib/actions/objectives.test.ts
git commit -m "feat: add listObjectivesWithStats split by status"
```

---

### Task 6: Celebrate a fulfilled weekly goal

**Files:**
- Modify: `src/components/week-goal-progress-card.tsx:10-85`
- Test: `src/components/week-goal-progress-card.test.tsx`

**Interfaces:**
- Consumes: `isGoalFulfilled` from `@/lib/objectives` (Task 1); `cn` from `@/lib/utils`
- Produces: nothing new — the component's props are unchanged

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('WeekGoalProgressCard', …)` block in `src/components/week-goal-progress-card.test.tsx`:

```tsx
  it('marks the card as fulfilled when every task for the week is complete', () => {
    const dailyTasks = [
      task({ id: 'task-1', date: new Date('2026-07-27'), completed: true }),
      task({ id: 'task-2', date: new Date('2026-07-28'), completed: true }),
    ]

    render(<WeekGoalProgressCard goal={{ ...weeklyGoal, dailyTasks }} />)

    expect(screen.getByText('✓ concluída')).toBeInTheDocument()
    expect(screen.getByText('Meta da semana fechada 🎯')).toBeInTheDocument()
    expect(screen.queryByText('2/2 tarefas')).not.toBeInTheDocument()
  })

  it('does not celebrate a partially complete week', () => {
    const dailyTasks = [
      task({ id: 'task-1', date: new Date('2026-07-27'), completed: true }),
      task({ id: 'task-2', date: new Date('2026-07-28'), completed: false }),
    ]

    render(<WeekGoalProgressCard goal={{ ...weeklyGoal, dailyTasks }} />)

    expect(screen.queryByText('✓ concluída')).not.toBeInTheDocument()
    expect(screen.getByText('1/2 tarefas')).toBeInTheDocument()
  })

  it('does not celebrate a goal that has no tasks at all', () => {
    render(<WeekGoalProgressCard goal={{ ...weeklyGoal, dailyTasks: [] }} />)

    expect(screen.queryByText('✓ concluída')).not.toBeInTheDocument()
    expect(screen.getByText('0/0 tarefas')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/week-goal-progress-card.test.tsx`
Expected: FAIL — `Unable to find an element with the text: ✓ concluída`.

- [ ] **Step 3: Write the implementation**

In `src/components/week-goal-progress-card.tsx`, add these imports:

```tsx
import { isGoalFulfilled } from '@/lib/objectives'
import { cn } from '@/lib/utils'
```

Add one line after the `percent`/`ringOffset` computation (currently lines 15-18):

```tsx
  const fulfilled = isGoalFulfilled(goal.dailyTasks)
```

Change the outer wrapper (currently line 21) from:

```tsx
    <div className="flex overflow-hidden rounded-lg border border-border">
```

to:

```tsx
    <div
      className={cn(
        'flex overflow-hidden rounded-lg border transition-colors motion-reduce:transition-none',
        fulfilled ? 'border-primary bg-accent' : 'border-border',
      )}
    >
```

And replace the closing label (currently lines 79-81):

```tsx
        <span className="mt-2 block text-sm text-muted-foreground">
          {completed}/{total} tarefas
        </span>
```

with:

```tsx
        {/* The ring's own `stroke-dashoffset` transition already animates it to
            full; this is the part that names what just happened. */}
        {fulfilled ? (
          <div className="mt-2 flex flex-col items-start gap-1">
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
              ✓ concluída
            </span>
            <span className="text-xs font-medium text-primary">Meta da semana fechada 🎯</span>
          </div>
        ) : (
          <span className="mt-2 block text-sm text-muted-foreground">
            {completed}/{total} tarefas
          </span>
        )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/week-goal-progress-card.test.tsx`
Expected: PASS, existing cases plus the three new ones.

- [ ] **Step 5: Commit**

```bash
git add src/components/week-goal-progress-card.tsx src/components/week-goal-progress-card.test.tsx
git commit -m "feat: celebrate a fulfilled weekly goal"
```

---

### Task 7: Mark today's share of a goal as done

**Files:**
- Modify: `src/components/today-task-group.tsx:14-39`
- Test: `src/components/today-task-group.test.tsx`

**Interfaces:**
- Consumes: `isGoalFulfilled` from `@/lib/objectives` (Task 1); `cn` from `@/lib/utils`
- Produces: nothing new

This is a **smaller** fact than Task 6's. `TodayTaskGroup` counts only today's tasks for the goal (`today-task-group.tsx:15`), so finishing them does not mean the week's goal is fulfilled. It gets the lighter treatment — a check in place of the count, and no reinforcement line — so the app never claims the week is closed when only the day is.

- [ ] **Step 1: Write the failing tests**

Create `src/components/today-task-group.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TodayTaskGroup } from '@/components/today-task-group'
import type { TaskGroup } from '@/lib/tasks'

const objective = {
  id: 'obj-1',
  title: 'Organizar finanças',
  description: null,
  startDate: new Date(2026, 6, 1),
  targetDate: null,
  status: 'ACTIVE' as const,
  createdAt: new Date(2026, 6, 1),
}

const weeklyGoal = {
  id: 'goal-1',
  title: 'Revisar orçamento',
  objectiveId: 'obj-1',
  weekStart: new Date(2026, 7, 17),
  weekEnd: new Date(2026, 7, 23),
  status: 'ACTIVE' as const,
  objective,
}

function group(completions: boolean[]): TaskGroup {
  return {
    weeklyGoal,
    tasks: completions.map((completed, index) => ({
      id: `task-${index}`,
      title: `Tarefa ${index}`,
      weeklyGoalId: 'goal-1',
      date: new Date(2026, 7, 19),
      completed,
      completedAt: completed ? new Date(2026, 7, 19) : null,
      weeklyGoal,
    })),
  }
}

describe('TodayTaskGroup', () => {
  it("shows a check once every one of today's tasks is done", () => {
    render(<TodayTaskGroup group={group([true, true])} onToggleTask={vi.fn()} />)

    expect(screen.getByText('✓ feito')).toBeInTheDocument()
    expect(screen.queryByText('2/2')).not.toBeInTheDocument()
  })

  it('still shows the count while any task is outstanding', () => {
    render(<TodayTaskGroup group={group([true, false])} onToggleTask={vi.fn()} />)

    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.queryByText('✓ feito')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/today-task-group.test.tsx`
Expected: FAIL — `Unable to find an element with the text: ✓ feito`.

- [ ] **Step 3: Write the implementation**

In `src/components/today-task-group.tsx`, add these imports:

```tsx
import { isGoalFulfilled } from '@/lib/objectives'
import { cn } from '@/lib/utils'
```

After the existing `completed` computation (line 15), add:

```tsx
  // Only today's tasks — this is the day being done, not the week's goal being
  // fulfilled. `WeekGoalProgressCard` owns that larger claim.
  const dayComplete = isGoalFulfilled(tasks)
```

Then replace the badge (currently lines 36-38):

```tsx
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-primary">
            {completed}/{tasks.length}
          </span>
```

with:

```tsx
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
              dayComplete ? 'bg-primary text-primary-foreground' : 'bg-accent text-primary',
            )}
          >
            {dayComplete ? '✓ feito' : `${completed}/${tasks.length}`}
          </span>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/today-task-group.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/today-task-group.tsx src/components/today-task-group.test.tsx
git commit -m "feat: mark today's share of a goal as done"
```

---

### Task 8: `ObjectiveStatsPanel` component

**Files:**
- Create: `src/components/objective-stats.tsx`
- Test: `src/components/objective-stats.test.tsx`

**Interfaces:**
- Consumes: `ObjectiveStats` from `@/lib/objectives` (Task 1); `cn` from `@/lib/utils`
- Produces: `export function ObjectiveStatsPanel({ stats, compact }: { stats: ObjectiveStats; compact?: boolean }): JSX.Element`

Named `ObjectiveStatsPanel`, not `ObjectiveStats`, because that is already the type name.

- [ ] **Step 1: Write the failing tests**

Create `src/components/objective-stats.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ObjectiveStatsPanel } from '@/components/objective-stats'

const week = (day: number, fulfilled: boolean) => ({
  weekStart: new Date(2026, 7, day),
  total: 3,
  completed: fulfilled ? 3 : 1,
  fulfilled,
})

const stats = {
  weeksFulfilled: 2,
  tasksCompleted: 312,
  weeksSinceStart: 104,
  recentWeeks: [week(3, true), week(10, false), week(17, true)],
}

describe('ObjectiveStatsPanel', () => {
  it('shows fulfilled weeks, completed tasks and how long the objective has run', () => {
    render(<ObjectiveStatsPanel stats={stats} />)

    expect(screen.getByText(/2 semanas cumpridas/)).toBeInTheDocument()
    expect(screen.getByText(/312 tarefas/)).toBeInTheDocument()
    expect(screen.getByText(/104 semanas/)).toBeInTheDocument()
  })

  it('renders one strip segment per week, fulfilled ones marked apart', () => {
    render(<ObjectiveStatsPanel stats={stats} />)

    const segments = screen.getAllByTestId('week-segment')

    expect(segments).toHaveLength(3)
    expect(segments.map((s) => s.getAttribute('data-fulfilled'))).toEqual(['true', 'false', 'true'])
  })

  it('uses the singular for a single fulfilled week', () => {
    render(<ObjectiveStatsPanel stats={{ ...stats, weeksFulfilled: 1 }} />)

    expect(screen.getByText(/1 semana cumprida/)).toBeInTheDocument()
  })

  it('omits the strip in compact mode', () => {
    render(<ObjectiveStatsPanel stats={stats} compact />)

    expect(screen.getByText(/2 semanas cumpridas/)).toBeInTheDocument()
    expect(screen.queryAllByTestId('week-segment')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/objective-stats.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/objective-stats"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/objective-stats.tsx`:

```tsx
import { format } from 'date-fns'
import type { ObjectiveStats } from '@/lib/objectives'
import { cn } from '@/lib/utils'

export function ObjectiveStatsPanel({
  stats,
  compact = false,
}: {
  stats: ObjectiveStats
  compact?: boolean
}) {
  const { weeksFulfilled, tasksCompleted, weeksSinceStart, recentWeeks } = stats

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        <span className="font-semibold text-primary">
          {weeksFulfilled} {weeksFulfilled === 1 ? 'semana cumprida' : 'semanas cumpridas'}
        </span>
        <span className="text-muted-foreground">
          {' · '}
          {tasksCompleted} {tasksCompleted === 1 ? 'tarefa' : 'tarefas'}
          {' · '}
          ativo há {weeksSinceStart} {weeksSinceStart === 1 ? 'semana' : 'semanas'}
        </span>
      </p>

      {!compact && recentWeeks.length > 0 && (
        <div className="flex h-3 gap-0.5" aria-hidden="true">
          {recentWeeks.map((week) => (
            <span
              key={week.weekStart.toISOString()}
              data-testid="week-segment"
              data-fulfilled={week.fulfilled}
              title={`Semana de ${format(week.weekStart, 'dd/MM')}: ${week.completed}/${week.total}`}
              className={cn('flex-1 rounded-sm', week.fulfilled ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/objective-stats.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/objective-stats.tsx src/components/objective-stats.test.tsx
git commit -m "feat: add ObjectiveStatsPanel component"
```

---

### Task 9: `ObjectiveStatusButton` component

**Files:**
- Create: `src/components/objective-status-button.tsx`
- Test: `src/components/objective-status-button.test.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`; `Status` type from `@prisma/client`
- Produces: `export function ObjectiveStatusButton({ status, onComplete, onReopen }: { status: Status; onComplete: () => Promise<void>; onReopen: () => Promise<void> }): JSX.Element`

No confirmation dialog. Completing is reversible by the same button, and interrupting a celebratory action with "are you sure?" sours the moment. The project's `DeleteButton` confirms because deletion cascades and cannot be undone — a different situation.

- [ ] **Step 1: Write the failing tests**

Create `src/components/objective-status-button.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ObjectiveStatusButton } from '@/components/objective-status-button'

describe('ObjectiveStatusButton', () => {
  it('offers to complete an active objective', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined)
    const onReopen = vi.fn().mockResolvedValue(undefined)
    render(<ObjectiveStatusButton status="ACTIVE" onComplete={onComplete} onReopen={onReopen} />)

    await userEvent.click(screen.getByRole('button', { name: /concluir objetivo/i }))

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onReopen).not.toHaveBeenCalled()
  })

  it('offers to reopen a completed objective', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined)
    const onReopen = vi.fn().mockResolvedValue(undefined)
    render(<ObjectiveStatusButton status="COMPLETED" onComplete={onComplete} onReopen={onReopen} />)

    await userEvent.click(screen.getByRole('button', { name: /reabrir/i }))

    expect(onReopen).toHaveBeenCalledTimes(1)
    expect(onComplete).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/objective-status-button.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/objective-status-button"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/objective-status-button.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import type { Status } from '@prisma/client'
import { Button } from '@/components/ui/button'

export function ObjectiveStatusButton({
  status,
  onComplete,
  onReopen,
}: {
  status: Status
  onComplete: () => Promise<void>
  onReopen: () => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()
  const isCompleted = status === 'COMPLETED'

  // No confirmation dialog: the action is undone by this same button, and
  // asking "are you sure?" before a celebration sours it.
  return (
    <Button
      type="button"
      variant={isCompleted ? 'secondary' : 'default'}
      disabled={isPending}
      onClick={() => startTransition(() => (isCompleted ? onReopen() : onComplete()))}
    >
      {isCompleted ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
      {isCompleted ? 'Reabrir' : 'Concluir objetivo'}
    </Button>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/objective-status-button.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/objective-status-button.tsx src/components/objective-status-button.test.tsx
git commit -m "feat: add ObjectiveStatusButton component"
```

---

### Task 10: Wire stats and completion into the objective page

**Files:**
- Modify: `src/app/objectives/[id]/page.tsx` (whole file)

**Interfaces:**
- Consumes: `getObjectiveStats`, `completeObjective`, `reopenObjective` (Tasks 3-4); `ObjectiveStatsPanel` (Task 8); `ObjectiveStatusButton` (Task 9)
- Produces: nothing new

No automated test — `src/app/` has no page-level tests and this plan does not introduce a page-testing setup. Verification is the full suite plus the manual check in Step 2.

- [ ] **Step 1: Rewrite `src/app/objectives/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import {
  completeObjective,
  getObjective,
  getObjectiveStats,
  reopenObjective,
} from '@/lib/actions/objectives'
import { getObjectiveProgressSeries } from '@/lib/actions/progress'
import { createDailyTasks } from '@/lib/actions/dailyTasks'
import { createWeeklyGoal, deleteWeeklyGoal, listWeeklyGoalsByObjective } from '@/lib/actions/weeklyGoals'
import { describeSchedule } from '@/lib/objectives'
import { ObjectiveProgressChart } from '@/components/objective-progress-chart'
import { ObjectiveStatsPanel } from '@/components/objective-stats'
import { ObjectiveStatusButton } from '@/components/objective-status-button'
import { WeeklyGoalsPanel } from '@/components/weekly-goals-panel'

export default async function ObjectiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const objective = await getObjective(id)
  if (!objective) notFound()

  const weeklyGoals = await listWeeklyGoalsByObjective(id)
  const series = await getObjectiveProgressSeries(id)
  const stats = await getObjectiveStats(id)
  const schedule = objective.completedAt
    ? describeSchedule(objective.completedAt, objective.targetDate)
    : null

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold break-words">{objective.title}</h1>
        <ObjectiveStatusButton
          status={objective.status}
          onComplete={completeObjective.bind(null, id)}
          onReopen={reopenObjective.bind(null, id)}
        />
      </div>

      <div className="mb-6">
        <ObjectiveStatsPanel stats={stats} />
        {objective.completedAt && (
          <p className="mt-2 text-sm font-medium text-primary">
            ✓ Concluído em {format(objective.completedAt, 'dd/MM/yyyy')}
            {schedule ? ` · ${schedule}` : ''}
          </p>
        )}
      </div>

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

- [ ] **Step 2: Run the suite, lint, and check manually**

```bash
npm test
npm run lint
npm run dev
```

Open an objective and confirm: the stats line and week strip render above the chart; "Concluir objetivo" flips the objective to completed, shows the completion line, and the button becomes "Reabrir"; clicking "Reabrir" removes the line.

- [ ] **Step 3: Commit**

```bash
git add src/app/objectives/[id]/page.tsx
git commit -m "feat: show objective stats and completion on the detail page"
```

---

### Task 11: Split the objectives list into active and completed

**Files:**
- Modify: `src/app/objectives/page.tsx` (whole file)

**Interfaces:**
- Consumes: `listObjectivesWithStats` (Task 5); `ObjectiveStatsPanel` (Task 8); `describeSchedule` (Task 1)
- Produces: nothing new

No automated test, same reasoning as Task 10.

- [ ] **Step 1: Rewrite `src/app/objectives/page.tsx`**

```tsx
import Link from 'next/link'
import { format } from 'date-fns'
import { deleteObjective, listObjectivesWithStats, type ObjectiveWithStats } from '@/lib/actions/objectives'
import { describeSchedule } from '@/lib/objectives'
import { DeleteButton } from '@/components/delete-button'
import { ObjectiveStatsPanel } from '@/components/objective-stats'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function ObjectiveRow({ objective }: { objective: ObjectiveWithStats }) {
  const schedule = objective.completedAt
    ? describeSchedule(objective.completedAt, objective.targetDate)
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link
            href={`/objectives/${objective.id}`}
            className="transition-colors hover:text-primary hover:underline"
          >
            {objective.title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ObjectiveStatsPanel stats={objective.stats} compact />

        {objective.completedAt && (
          <p className="text-sm font-medium text-primary">
            ✓ Concluído em {format(objective.completedAt, 'dd/MM/yyyy')}
            {schedule ? ` · ${schedule}` : ''}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href={`/objectives/${objective.id}/edit`} />}
          >
            Editar
          </Button>
          <DeleteButton
            action={deleteObjective.bind(null, objective.id)}
            confirmDescription="Isso também excluirá todas as metas semanais e tarefas diárias relacionadas. Esta ação não pode ser desfeita."
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default async function ObjectivesPage() {
  const { active, completed } = await listObjectivesWithStats()

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Objetivos</h1>
        <Button nativeButton={false} render={<Link href="/objectives/new" />}>
          Novo objetivo
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {active.map((objective) => (
          <ObjectiveRow key={objective.id} objective={objective} />
        ))}
      </div>

      {/* Kept below the active ones rather than mixed in: with ten achievements
          the two objectives still in play would otherwise disappear among them. */}
      {completed.length > 0 && (
        <>
          <h2 className="mt-10 mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Concluídos
          </h2>
          <div className="flex flex-col gap-4">
            {completed.map((objective) => (
              <ObjectiveRow key={objective.id} objective={objective} />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 2: Run the suite, lint, and build**

```bash
npm test
npm run lint
npm run build
```

Expected: all green.

- [ ] **Step 3: Check manually**

```bash
npm run dev
```

At `/objectives`: active objectives appear first with their compact stats and no raw `ACTIVE` string; a completed objective moves below the "Concluídos" heading with its completion date, and with the schedule comparison when the objective had a `targetDate`.

- [ ] **Step 4: Commit**

```bash
git add src/app/objectives/page.tsx
git commit -m "feat: split objectives into active and completed sections"
```

---

## Verification

Full check after all eleven tasks:

```bash
npm test
npm run lint
npm run build
```

## Notes for the executor

- **`WeeklyGoal.status` is deliberately never written.** Fulfilment is derived every time. If you find yourself wanting to store it, re-read the spec — a stored flag and a computed one will eventually disagree, and the computed one is the truth.
- **Do not add "mark this partial week as done".** A 4-of-5 week not celebrating is the design, not an oversight: the lifetime banner already rewards each of those four tasks, which is what lets the weekly signal stay expensive.
- **`isGoalFulfilled([])` returns `false`, and that matters more than it looks.** `[].every(…)` is `true` in JavaScript, so an unplanned goal would otherwise report itself fulfilled.
- **Objective completion is manual only.** Do not add inference from inactivity — an abandoned objective and a fulfilled one produce identical data, and `ABANDONED` exists in the enum precisely because they are different outcomes.
- Task 2 renames an existing test but does not change its assertions; it passes before and after, because the defect it documents only appears with two goals in one week.
