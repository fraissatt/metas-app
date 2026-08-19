# Home States and Week Resumption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single dead-end empty state on the home page (`"Nenhuma tarefa para hoje."`) with four distinct states, and offer to bring forward any weekly goal that was in the last planned week but is missing from this one.

**Architecture:** One module-private helper (`findMissingGoals`) computes the difference between the last planned week and the current one; a read action and a transactional write action are both built on it. `src/app/page.tsx` — already a Server Component doing all the fetching — resolves which of the four states applies. The offer to bring goals forward is one client component rendered in two places: as the body of the full-page return state, and as a compact card under the normal layout.

**Tech Stack:** Next.js 16 (App Router, Server Components, Server Actions), Prisma 6 + Postgres, Tailwind v4 with tokens from `globals.css`, shadcn/ui on Base UI, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-19-progresso-acumulado-e-retomada-design.md`

**Depends on:** `docs/superpowers/plans/2026-08-19-faixa-progresso-vitalicio.md` — Task 8 renders `LifetimeProgressBanner` and calls `getLifetimeStats`, both built there. Do not start this plan until that one is merged.

## Global Constraints

- **`getWeekBounds`** (`src/lib/dates.ts:3`) is the only authority on when a week starts. No raw SQL, no hand-rolled Monday math.
- **No schema change and no migration.**
- **A goal's identity across weeks is the `objectiveId` + `title` pair.** Never match on title alone — two objectives can legitimately both have a goal called "Revisar orçamento".
- Style only with existing design tokens (`bg-accent`, `border-border`, `border-primary`, `text-primary`, `text-muted-foreground`). No hardcoded colors.
- Buttons that navigate use the project's link-button pattern: `<Button nativeButton={false} render={<Link href="…" />}>` (see `src/app/objectives/page.tsx:15`). Do not wrap a `Button` in an `<a>`.
- Server actions passed into client components are passed as props, following `onToggleTask={toggleDailyTask}` in `src/app/page.tsx`.
- All UI copy is Portuguese (pt-BR). Dates render as `dd/MM` via `date-fns` `format` — no `date-fns/locale` import.
- Tests: Vitest + Testing Library, plain fixtures, `vi.fn()` only. DB tests hit `metas_app_test`; `src/test/setup.ts` truncates all three tables after each test.
- Run a single file with `npx vitest run <path>`, the full suite with `npm test`. Test DB must be up (`docker compose up -d`) and migrated (`npm run test:migrate`).
- **`'use server'` files may only export async functions.** Types may be exported (erased at compile time); synchronous helpers must stay unexported.

---

### Task 1: `countObjectives`

**Files:**
- Modify: `src/lib/actions/objectives.ts` (append after `listObjectives`, around line 27)
- Test: `src/lib/actions/objectives.test.ts` (append a case inside the existing `describe('objective actions', …)`)

**Interfaces:**
- Produces: `export async function countObjectives(): Promise<number>`

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe('objective actions', () => { … })` block in `src/lib/actions/objectives.test.ts`:

```ts
  it('counts objectives without loading their rows', async () => {
    expect(await countObjectives()).toBe(0)

    await prisma.objective.createMany({
      data: [
        { title: 'Primeiro', startDate: new Date() },
        { title: 'Segundo', startDate: new Date() },
      ],
    })

    expect(await countObjectives()).toBe(2)
  })
```

Add `countObjectives` to the existing multi-line import from `@/lib/actions/objectives` at the top of the file (it currently spans lines 4-11).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/actions/objectives.test.ts`
Expected: FAIL — `countObjectives is not a function`.

- [ ] **Step 3: Write the implementation**

Add to `src/lib/actions/objectives.ts`, directly after `listObjectives`:

```ts
// A count rather than `(await listObjectives()).length`: the home page only
// needs to know whether any objective exists, and should not pull every row to
// find out.
export async function countObjectives(): Promise<number> {
  return prisma.objective.count()
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/actions/objectives.test.ts`
Expected: PASS, all cases including the new one.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/objectives.ts src/lib/actions/objectives.test.ts
git commit -m "feat: add countObjectives action"
```

---

### Task 2: `findMissingGoals` and `getMissingGoalsPreview`

**Files:**
- Modify: `src/lib/actions/weeklyGoals.ts` (append after `listWeeklyGoalsForCurrentWeek`, line 62)
- Test: `src/lib/actions/weeklyGoals.test.ts` (append cases inside the existing `describe('weekly goal actions', …)`)

**Interfaces:**
- Consumes: `getWeekBounds` from `@/lib/dates`; `prisma` from `@/lib/db`
- Produces: `export type MissingGoalsPreview = { sourceWeekStart: Date; goals: Array<{ id: string; title: string; taskCount: number }> }`
- Produces: `export async function getMissingGoalsPreview(): Promise<MissingGoalsPreview | null>`
- Produces (module-private, used by Task 3): `async function findMissingGoals(currentWeekStart: Date, db?: Prisma.TransactionClient): Promise<{ sourceWeekStart: Date; goals: Array<WeeklyGoal & { dailyTasks: DailyTask[] }> } | null>`

The `db` parameter is what lets Task 3 re-run the same computation inside its transaction.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('weekly goal actions', () => { … })` block in `src/lib/actions/weeklyGoals.test.ts`. Add `getMissingGoalsPreview` to the existing import list (lines 4-12), and change the `date-fns` import on line 2 to `import { addWeeks, format } from 'date-fns'`:

```ts
  it('offers nothing when there is no earlier week at all', async () => {
    const objective = await makeObjective()
    await prisma.weeklyGoal.create({
      data: { title: 'Atual', objectiveId: objective.id, ...getWeekBounds(new Date()) },
    })

    expect(await getMissingGoalsPreview()).toBeNull()
  })

  it('offers nothing when every source goal already has a counterpart this week', async () => {
    const objective = await makeObjective()
    const currentWeek = getWeekBounds(new Date())
    const lastWeek = getWeekBounds(addWeeks(currentWeek.weekStart, -1))
    await prisma.weeklyGoal.create({
      data: { title: 'Praticar inglês', objectiveId: objective.id, ...lastWeek },
    })
    await prisma.weeklyGoal.create({
      data: { title: 'Praticar inglês', objectiveId: objective.id, ...currentWeek },
    })

    expect(await getMissingGoalsPreview()).toBeNull()
  })

  it('offers the most recent earlier week, skipping empty weeks in between', async () => {
    const objective = await makeObjective()
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const oneWeekAgo = getWeekBounds(addWeeks(currentWeekStart, -1))
    const fourWeeksAgo = getWeekBounds(addWeeks(currentWeekStart, -4))

    await prisma.weeklyGoal.create({
      data: { title: 'Antiga', objectiveId: objective.id, ...fourWeeksAgo },
    })
    await prisma.weeklyGoal.create({
      data: { title: 'Recente', objectiveId: objective.id, ...oneWeekAgo },
    })

    const preview = await getMissingGoalsPreview()

    expect(preview?.sourceWeekStart).toEqual(oneWeekAgo.weekStart)
    expect(preview?.goals.map((g) => g.title)).toEqual(['Recente'])
  })

  it('offers only the goals without a counterpart, ordered by title', async () => {
    const objective = await makeObjective()
    const currentWeek = getWeekBounds(new Date())
    const lastWeek = getWeekBounds(addWeeks(currentWeek.weekStart, -1))

    const zebra = await prisma.weeklyGoal.create({
      data: { title: 'Zebra', objectiveId: objective.id, ...lastWeek },
    })
    const alfa = await prisma.weeklyGoal.create({
      data: { title: 'Alfa', objectiveId: objective.id, ...lastWeek },
    })
    await prisma.weeklyGoal.create({
      data: { title: 'Meio', objectiveId: objective.id, ...lastWeek },
    })
    // Already brought over by hand — must not be offered again.
    await prisma.weeklyGoal.create({
      data: { title: 'Meio', objectiveId: objective.id, ...currentWeek },
    })
    await prisma.dailyTask.createMany({
      data: [
        { title: 'T1', weeklyGoalId: alfa.id, date: lastWeek.weekStart },
        { title: 'T2', weeklyGoalId: alfa.id, date: lastWeek.weekStart },
        { title: 'T3', weeklyGoalId: zebra.id, date: lastWeek.weekStart },
      ],
    })

    const preview = await getMissingGoalsPreview()

    // Alphabetical, not insertion order: without an explicit `orderBy` Postgres
    // returns rows in an unspecified order and the list would reshuffle between
    // renders of identical data.
    expect(preview?.goals).toEqual([
      { id: alfa.id, title: 'Alfa', taskCount: 2 },
      { id: zebra.id, title: 'Zebra', taskCount: 1 },
    ])
  })

  it('treats a same-titled goal under a different objective as still missing', async () => {
    const first = await makeObjective()
    const second = await prisma.objective.create({
      data: { title: 'Outro', startDate: new Date() },
    })
    const currentWeek = getWeekBounds(new Date())
    const lastWeek = getWeekBounds(addWeeks(currentWeek.weekStart, -1))

    await prisma.weeklyGoal.create({
      data: { title: 'Revisar orçamento', objectiveId: first.id, ...lastWeek },
    })
    // Same title, different objective — not a counterpart.
    await prisma.weeklyGoal.create({
      data: { title: 'Revisar orçamento', objectiveId: second.id, ...currentWeek },
    })

    const preview = await getMissingGoalsPreview()

    expect(preview?.goals.map((g) => g.title)).toEqual(['Revisar orçamento'])
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`
Expected: FAIL — `getMissingGoalsPreview is not a function`.

- [ ] **Step 3: Write the implementation**

Change the type import on line 7 of `src/lib/actions/weeklyGoals.ts` to `import type { DailyTask, Prisma, WeeklyGoal } from '@prisma/client'`, then append:

```ts
export type MissingGoalsPreview = {
  sourceWeekStart: Date
  goals: Array<{ id: string; title: string; taskCount: number }>
}

type SourceGoal = WeeklyGoal & { dailyTasks: DailyTask[] }

// A goal's identity across weeks is the objective it belongs to plus its
// title. A space is an unambiguous separator here because `objectiveId` is a
// cuid — alphanumeric, never containing one — so the first space in the key
// always marks the boundary, whatever the user typed as a title.
function goalKey(goal: { objectiveId: string; title: string }): string {
  return `${goal.objectiveId} ${goal.title}`
}

/**
 * The goals from the last planned week that have no counterpart in the current
 * one. The source week is the most recent week that actually had goals — not
 * simply the previous calendar week, since someone away for three weeks would
 * find that one empty, and that is exactly the user this serves.
 *
 * `db` defaults to the shared client; Task 3 passes its transaction client so
 * the write recomputes this set atomically instead of trusting a stale render.
 *
 * Not exported: this module is `'use server'`, where every export becomes a
 * callable server action.
 */
async function findMissingGoals(
  currentWeekStart: Date,
  db: Prisma.TransactionClient = prisma,
): Promise<{ sourceWeekStart: Date; goals: SourceGoal[] } | null> {
  const previous = await db.weeklyGoal.findFirst({
    where: { weekStart: { lt: currentWeekStart } },
    orderBy: { weekStart: 'desc' },
    select: { weekStart: true },
  })
  if (!previous) return null

  const [sourceGoals, currentGoals] = await Promise.all([
    db.weeklyGoal.findMany({
      where: { weekStart: previous.weekStart },
      orderBy: { title: 'asc' },
      include: { dailyTasks: true },
    }),
    db.weeklyGoal.findMany({
      where: { weekStart: currentWeekStart },
      select: { objectiveId: true, title: true },
    }),
  ])

  const alreadyHere = new Set(currentGoals.map(goalKey))

  return {
    sourceWeekStart: previous.weekStart,
    goals: sourceGoals.filter((goal) => !alreadyHere.has(goalKey(goal))),
  }
}

export async function getMissingGoalsPreview(): Promise<MissingGoalsPreview | null> {
  const { weekStart: currentWeekStart } = getWeekBounds(new Date())
  const missing = await findMissingGoals(currentWeekStart)
  if (!missing || missing.goals.length === 0) return null

  return {
    sourceWeekStart: missing.sourceWeekStart,
    goals: missing.goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      taskCount: goal.dailyTasks.length,
    })),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`
Expected: PASS, existing cases plus the five new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/weeklyGoals.ts src/lib/actions/weeklyGoals.test.ts
git commit -m "feat: add getMissingGoalsPreview action"
```

---

### Task 3: `repeatMissingGoals`

**Files:**
- Modify: `src/lib/actions/weeklyGoals.ts` (append after `getMissingGoalsPreview`)
- Test: `src/lib/actions/weeklyGoals.test.ts` (append cases inside the same `describe`)

**Interfaces:**
- Consumes: `findMissingGoals` (Task 2, module-private); `getWeekBounds`; `prisma`; `revalidatePath` from `next/cache`
- Produces: `export async function repeatMissingGoals(): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Append inside the same `describe` block, adding `repeatMissingGoals` to the import list and changing the `date-fns` import on line 2 to `import { addDays, addWeeks, differenceInCalendarDays, format } from 'date-fns'`:

```ts
  it('brings missing goals and their tasks into the current week, reset to incomplete', async () => {
    const objective = await makeObjective()
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const lastWeek = getWeekBounds(addWeeks(currentWeekStart, -1))
    const goal = await prisma.weeklyGoal.create({
      data: { title: 'Revisar orçamento', objectiveId: objective.id, ...lastWeek },
    })
    await prisma.dailyTask.create({
      data: {
        title: 'Categorizar gastos',
        weeklyGoalId: goal.id,
        date: addDays(lastWeek.weekStart, 1),
        completed: true,
        completedAt: new Date(),
      },
    })

    await repeatMissingGoals()

    const created = await prisma.weeklyGoal.findMany({
      where: { weekStart: currentWeekStart },
      include: { dailyTasks: true },
    })

    expect(created).toHaveLength(1)
    expect(created[0].title).toBe('Revisar orçamento')
    expect(created[0].objectiveId).toBe(objective.id)
    expect(created[0].weekEnd).toEqual(getWeekBounds(currentWeekStart).weekEnd)
    expect(created[0].dailyTasks).toHaveLength(1)
    expect(created[0].dailyTasks[0].title).toBe('Categorizar gastos')
    expect(created[0].dailyTasks[0].completed).toBe(false)
    expect(created[0].dailyTasks[0].completedAt).toBeNull()
  })

  it('lands each brought-over task on the same weekday it had in the source week', async () => {
    const objective = await makeObjective()
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const lastWeek = getWeekBounds(addWeeks(currentWeekStart, -1))
    const goal = await prisma.weeklyGoal.create({
      data: { title: 'Meta', objectiveId: objective.id, ...lastWeek },
    })
    await prisma.dailyTask.createMany({
      data: [
        { title: 'Terça', weeklyGoalId: goal.id, date: addDays(lastWeek.weekStart, 1) },
        { title: 'Sábado', weeklyGoalId: goal.id, date: addDays(lastWeek.weekStart, 5) },
      ],
    })

    await repeatMissingGoals()

    const [created] = await prisma.weeklyGoal.findMany({
      where: { weekStart: currentWeekStart },
      include: { dailyTasks: { orderBy: { date: 'asc' } } },
    })

    expect(differenceInCalendarDays(created.dailyTasks[0].date, currentWeekStart)).toBe(1)
    expect(differenceInCalendarDays(created.dailyTasks[1].date, currentWeekStart)).toBe(5)
  })

  it('leaves goals that already have a counterpart untouched and un-duplicated', async () => {
    const objective = await makeObjective()
    const currentWeek = getWeekBounds(new Date())
    const lastWeek = getWeekBounds(addWeeks(currentWeek.weekStart, -1))
    await prisma.weeklyGoal.create({
      data: { title: 'Já trouxe', objectiveId: objective.id, ...lastWeek },
    })
    await prisma.weeklyGoal.create({
      data: { title: 'Faltou', objectiveId: objective.id, ...lastWeek },
    })
    await prisma.weeklyGoal.create({
      data: { title: 'Já trouxe', objectiveId: objective.id, ...currentWeek },
    })

    await repeatMissingGoals()

    const current = await prisma.weeklyGoal.findMany({
      where: { weekStart: currentWeek.weekStart },
      orderBy: { title: 'asc' },
    })

    expect(current.map((g) => g.title)).toEqual(['Faltou', 'Já trouxe'])
  })

  it('creates the goals once when called twice in a row', async () => {
    const objective = await makeObjective()
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const lastWeek = getWeekBounds(addWeeks(currentWeekStart, -1))
    const goal = await prisma.weeklyGoal.create({
      data: { title: 'Meta', objectiveId: objective.id, ...lastWeek },
    })
    await prisma.dailyTask.create({
      data: { title: 'Tarefa', weeklyGoalId: goal.id, date: lastWeek.weekStart },
    })

    await repeatMissingGoals()
    await repeatMissingGoals()

    const created = await prisma.weeklyGoal.findMany({
      where: { weekStart: currentWeekStart },
      include: { dailyTasks: true },
    })

    expect(created).toHaveLength(1)
    expect(created[0].dailyTasks).toHaveLength(1)
  })

  it('does nothing when there is no earlier week to draw from', async () => {
    await makeObjective()

    await repeatMissingGoals()

    expect(await prisma.weeklyGoal.findMany()).toHaveLength(0)
  })

  it('brings goals from several objectives in the same source week', async () => {
    const first = await makeObjective()
    const second = await prisma.objective.create({
      data: { title: 'Outro', startDate: new Date() },
    })
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const lastWeek = getWeekBounds(addWeeks(currentWeekStart, -1))
    await prisma.weeklyGoal.create({ data: { title: 'A', objectiveId: first.id, ...lastWeek } })
    await prisma.weeklyGoal.create({ data: { title: 'B', objectiveId: second.id, ...lastWeek } })

    await repeatMissingGoals()

    const created = await prisma.weeklyGoal.findMany({ where: { weekStart: currentWeekStart } })

    expect(created).toHaveLength(2)
    expect(new Set(created.map((g) => g.objectiveId))).toEqual(new Set([first.id, second.id]))
  })

  it('brings over a goal that has no tasks', async () => {
    const objective = await makeObjective()
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const lastWeek = getWeekBounds(addWeeks(currentWeekStart, -1))
    await prisma.weeklyGoal.create({
      data: { title: 'Vazia', objectiveId: objective.id, ...lastWeek },
    })

    await repeatMissingGoals()

    const created = await prisma.weeklyGoal.findMany({
      where: { weekStart: currentWeekStart },
      include: { dailyTasks: true },
    })

    expect(created).toHaveLength(1)
    expect(created[0].dailyTasks).toEqual([])
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`
Expected: FAIL — `repeatMissingGoals is not a function`.

- [ ] **Step 3: Write the implementation**

Add `import { addDays, differenceInCalendarDays } from 'date-fns'` to the imports of `src/lib/actions/weeklyGoals.ts` (the file currently imports nothing from `date-fns`), then append:

```ts
export async function repeatMissingGoals(): Promise<void> {
  const { weekStart: currentWeekStart, weekEnd: currentWeekEnd } = getWeekBounds(new Date())
  let touchedObjectiveIds: string[] = []

  await prisma.$transaction(async (tx) => {
    // Recomputed inside the transaction rather than reusing what the page
    // rendered: two rapid clicks would otherwise both act on a stale set and
    // create the same goals twice. The second call finds nothing missing.
    const missing = await findMissingGoals(currentWeekStart, tx)
    if (!missing || missing.goals.length === 0) return

    touchedObjectiveIds = [...new Set(missing.goals.map((goal) => goal.objectiveId))]

    for (const goal of missing.goals) {
      // `completed` and `completedAt` are left to their schema defaults
      // (false / null) — a week brought forward starts unfinished.
      const clone = await tx.weeklyGoal.create({
        data: {
          title: goal.title,
          objectiveId: goal.objectiveId,
          weekStart: currentWeekStart,
          weekEnd: currentWeekEnd,
        },
      })

      if (goal.dailyTasks.length === 0) continue

      await tx.dailyTask.createMany({
        data: goal.dailyTasks.map((task) => ({
          title: task.title,
          weeklyGoalId: clone.id,
          // Offset in calendar days, not elapsed milliseconds: a DST change
          // inside the source week would otherwise shift a task onto the
          // wrong weekday.
          date: addDays(currentWeekStart, differenceInCalendarDays(task.date, missing.sourceWeekStart)),
        })),
      })
    }
  })

  // Outside the transaction: cache invalidation is not part of the write, and
  // must not run at all if the write rolled back.
  revalidatePath('/')
  for (const objectiveId of touchedObjectiveIds) {
    revalidatePath(`/objectives/${objectiveId}`)
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`
Expected: PASS, all existing cases plus the seven new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/weeklyGoals.ts src/lib/actions/weeklyGoals.test.ts
git commit -m "feat: add repeatMissingGoals action"
```

---

### Task 4: `HomeEmptyState` component

**Files:**
- Create: `src/components/home-empty-state.tsx`
- Test: `src/components/home-empty-state.test.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`
- Produces: `export function HomeEmptyState({ variant }: { variant: 'no-objective' | 'no-goal' }): JSX.Element`

Covers S1 (no objective exists) and S2b (an objective exists but nothing can be brought forward). The two differ only in copy and CTA target.

- [ ] **Step 1: Write the failing tests**

Create `src/components/home-empty-state.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomeEmptyState } from '@/components/home-empty-state'

describe('HomeEmptyState', () => {
  it('sends a brand-new user to the objective form', () => {
    render(<HomeEmptyState variant="no-objective" />)

    expect(screen.getByRole('link', { name: /primeiro objetivo/i })).toHaveAttribute(
      'href',
      '/objectives/new',
    )
  })

  it('sends a user who has an objective but no weekly goal to the objectives list', () => {
    render(<HomeEmptyState variant="no-goal" />)

    expect(screen.getByRole('link', { name: /objetivo/i })).toHaveAttribute('href', '/objectives')
  })

  it('gives each variant its own heading, so the two are not interchangeable', () => {
    const { unmount } = render(<HomeEmptyState variant="no-objective" />)
    expect(screen.getByRole('heading')).toHaveTextContent('Comece pelo primeiro objetivo')
    unmount()

    render(<HomeEmptyState variant="no-goal" />)
    expect(screen.getByRole('heading')).toHaveTextContent('Defina a primeira meta semanal')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/home-empty-state.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/home-empty-state"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/home-empty-state.tsx`:

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const COPY = {
  'no-objective': {
    heading: 'Comece pelo primeiro objetivo',
    body: 'Um objetivo se divide em metas semanais, e cada meta em tarefas do dia.',
    cta: 'Criar meu primeiro objetivo',
    href: '/objectives/new',
  },
  'no-goal': {
    heading: 'Defina a primeira meta semanal',
    body: 'Seu objetivo já existe. Falta quebrá-lo em uma meta para esta semana.',
    cta: 'Escolher um objetivo',
    href: '/objectives',
  },
} as const

export function HomeEmptyState({ variant }: { variant: keyof typeof COPY }) {
  const { heading, body, cta, href } = COPY[variant]

  return (
    <section className="mx-auto flex max-w-sm flex-col items-center gap-4 py-12 text-center">
      <h1 className="text-2xl font-semibold">{heading}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
      <Button nativeButton={false} render={<Link href={href} />}>
        {cta}
      </Button>
    </section>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/home-empty-state.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/home-empty-state.tsx src/components/home-empty-state.test.tsx
git commit -m "feat: add HomeEmptyState component"
```

---

### Task 5: `MissingGoalsCard` component

**Files:**
- Create: `src/components/missing-goals-card.tsx`
- Test: `src/components/missing-goals-card.test.tsx`

**Interfaces:**
- Consumes: `MissingGoalsPreview` from `@/lib/actions/weeklyGoals` (Task 2, type-only import); `Button` from `@/components/ui/button`
- Produces: `export function MissingGoalsCard({ preview, onRepeat }: { preview: MissingGoalsPreview; onRepeat: () => Promise<void> }): JSX.Element`

This is the whole offer, identical in both places it appears — S2 wraps it (Task 6), S3 renders it bare (Task 8). A client component: the button needs a pending state while the server action runs, following `src/components/task-toggle.tsx:15`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/missing-goals-card.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MissingGoalsCard } from '@/components/missing-goals-card'

const preview = {
  sourceWeekStart: new Date(2026, 7, 10), // Monday 10/08
  goals: [
    { id: 'goal-a', title: 'Revisar orçamento', taskCount: 4 },
    { id: 'goal-b', title: 'Praticar inglês', taskCount: 1 },
  ],
}

describe('MissingGoalsCard', () => {
  it('lists each missing goal with its task count', () => {
    render(<MissingGoalsCard preview={preview} onRepeat={vi.fn()} />)

    expect(screen.getByText('Revisar orçamento')).toBeInTheDocument()
    expect(screen.getByText('4 tarefas')).toBeInTheDocument()
    expect(screen.getByText('Praticar inglês')).toBeInTheDocument()
    expect(screen.getByText('1 tarefa')).toBeInTheDocument()
  })

  it('names the week the goals came from', () => {
    render(<MissingGoalsCard preview={preview} onRepeat={vi.fn()} />)

    expect(screen.getByText(/semana de 10\/08/i)).toBeInTheDocument()
  })

  it('calls onRepeat once when the button is clicked', async () => {
    const onRepeat = vi.fn().mockResolvedValue(undefined)
    render(<MissingGoalsCard preview={preview} onRepeat={onRepeat} />)

    await userEvent.click(screen.getByRole('button', { name: /trazer/i }))

    expect(onRepeat).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/missing-goals-card.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/missing-goals-card"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/missing-goals-card.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { format } from 'date-fns'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MissingGoalsPreview } from '@/lib/actions/weeklyGoals'

export function MissingGoalsCard({
  preview,
  onRepeat,
}: {
  preview: MissingGoalsPreview
  onRepeat: () => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()

  return (
    // Listed before the click rather than behind a confirmation step: it tells
    // the user what the button will do and, just as importantly, reminds them
    // what they had committed to.
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Ficou para trás · semana de {format(preview.sourceWeekStart, 'dd/MM')}
      </span>

      <div className="flex flex-col gap-1">
        {preview.goals.map((goal) => (
          <div key={goal.id} className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 break-words">{goal.title}</span>
            <span className="shrink-0 text-muted-foreground">
              {goal.taskCount} {goal.taskCount === 1 ? 'tarefa' : 'tarefas'}
            </span>
          </div>
        ))}
      </div>

      <Button type="button" disabled={isPending} onClick={() => startTransition(() => onRepeat())}>
        <RotateCcw className="size-4" />
        {isPending ? 'Trazendo…' : 'Trazer para esta semana'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/missing-goals-card.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/missing-goals-card.tsx src/components/missing-goals-card.test.tsx
git commit -m "feat: add MissingGoalsCard component"
```

---

### Task 6: `ReturnEmptyState` wrapper

**Files:**
- Create: `src/components/return-empty-state.tsx`
- Test: `src/components/return-empty-state.test.tsx`

**Interfaces:**
- Consumes: `MissingGoalsCard` (Task 5); `MissingGoalsPreview` from `@/lib/actions/weeklyGoals`; `Button` from `@/components/ui/button`
- Produces: `export function ReturnEmptyState({ preview, onRepeat }: { preview: MissingGoalsPreview; onRepeat: () => Promise<void> }): JSX.Element`

No `'use client'`. This is a Server Component that renders a Client Component and forwards the server action to it — the same arrangement `page.tsx` already uses for `FluidDayWeek`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/return-empty-state.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReturnEmptyState } from '@/components/return-empty-state'

const preview = {
  sourceWeekStart: new Date(2026, 7, 10),
  goals: [{ id: 'goal-a', title: 'Revisar orçamento', taskCount: 4 }],
}

describe('ReturnEmptyState', () => {
  it('frames the card with the empty-week line', () => {
    render(<ReturnEmptyState preview={preview} onRepeat={vi.fn()} />)

    expect(screen.getByText('Sua semana ainda está vazia.')).toBeInTheDocument()
  })

  it('renders the offer itself', () => {
    render(<ReturnEmptyState preview={preview} onRepeat={vi.fn()} />)

    expect(screen.getByText('Revisar orçamento')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /trazer/i })).toBeInTheDocument()
  })

  it('offers building the week from scratch instead', () => {
    render(<ReturnEmptyState preview={preview} onRepeat={vi.fn()} />)

    expect(screen.getByRole('link', { name: /nova meta semanal/i })).toHaveAttribute(
      'href',
      '/objectives',
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/return-empty-state.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/return-empty-state"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/return-empty-state.tsx`:

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MissingGoalsCard } from '@/components/missing-goals-card'
import type { MissingGoalsPreview } from '@/lib/actions/weeklyGoals'

export function ReturnEmptyState({
  preview,
  onRepeat,
}: {
  preview: MissingGoalsPreview
  onRepeat: () => Promise<void>
}) {
  return (
    <section className="mx-auto flex max-w-sm flex-col gap-4 py-12">
      <p className="text-center text-sm text-muted-foreground">Sua semana ainda está vazia.</p>

      <MissingGoalsCard preview={preview} onRepeat={onRepeat} />

      {/* A link rather than an inline form: creating a weekly goal requires
          picking an objective, which happens on /objectives/[id]. */}
      <Button variant="outline" nativeButton={false} render={<Link href="/objectives" />}>
        + Nova meta semanal
      </Button>
    </section>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/return-empty-state.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/return-empty-state.tsx src/components/return-empty-state.test.tsx
git commit -m "feat: add ReturnEmptyState wrapper"
```

---

### Task 7: Give the "no tasks today" state a way forward

**Files:**
- Modify: `src/components/fluid-day-week.tsx:89-91`
- Test: `src/components/fluid-day-week.test.tsx:152-157`

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new

This is state S3 with an empty day: the week is planned, but nothing is scheduled for today. Today the user gets a sentence and no action.

- [ ] **Step 1: Update the existing failing test**

Replace the existing case at `src/components/fluid-day-week.test.tsx:152-157` with:

```tsx
  it('shows empty-state copy and a way to add work when there are no tasks or goals', () => {
    render(<FluidDayWeek tasks={[]} goals={[]} onToggleTask={vi.fn()} />)

    expect(screen.getByText('Nenhuma tarefa para hoje.')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma meta semanal para esta semana.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /adicionar tarefa/i })).toHaveAttribute(
      'href',
      '/objectives',
    )
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/fluid-day-week.test.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "link" and name /adicionar tarefa/i`.

- [ ] **Step 3: Write the implementation**

Add `import Link from 'next/link'` to the imports at the top of `src/components/fluid-day-week.tsx`, then replace lines 89-91:

```tsx
        {optimisticState.tasks.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma tarefa para hoje.</p>
        ) : (
```

with:

```tsx
        {optimisticState.tasks.length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-muted-foreground">Nenhuma tarefa para hoje.</p>
            <Link href="/objectives" className="text-sm font-medium text-primary hover:underline">
              + Adicionar tarefa a uma meta
            </Link>
          </div>
        ) : (
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/fluid-day-week.test.tsx`
Expected: PASS, all cases in the file.

- [ ] **Step 5: Commit**

```bash
git add src/components/fluid-day-week.tsx src/components/fluid-day-week.test.tsx
git commit -m "feat: offer an action when today has no tasks"
```

---

### Task 8: Resolve the four home states

**Files:**
- Modify: `src/app/page.tsx` (whole file)

**Interfaces:**
- Consumes: `countObjectives` (Task 1); `getMissingGoalsPreview`, `repeatMissingGoals` (Tasks 2-3); `HomeEmptyState` (Task 4); `MissingGoalsCard` (Task 5); `ReturnEmptyState` (Task 6); `getLifetimeStats` and `LifetimeProgressBanner` from the prerequisite plan
- Produces: nothing new

No automated test — `src/app/` has no page-level tests and this plan does not introduce a page-testing setup. Verification is the full suite plus the manual walkthrough in Step 3, which exercises all four states.

- [ ] **Step 1: Rewrite `src/app/page.tsx`**

```tsx
import { listDailyTasksByDate, toggleDailyTask } from '@/lib/actions/dailyTasks'
import { countObjectives } from '@/lib/actions/objectives'
import { getLifetimeStats } from '@/lib/actions/stats'
import {
  getMissingGoalsPreview,
  listWeeklyGoalsForCurrentWeek,
  repeatMissingGoals,
} from '@/lib/actions/weeklyGoals'
import { FluidDayWeek } from '@/components/fluid-day-week'
import { HomeEmptyState } from '@/components/home-empty-state'
import { LifetimeProgressBanner } from '@/components/lifetime-progress-banner'
import { MissingGoalsCard } from '@/components/missing-goals-card'
import { ReturnEmptyState } from '@/components/return-empty-state'

// This page's correctness depends on the wall clock at request time (it
// filters tasks by "today" and computes "the current week" from `new
// Date()`), so it must never be statically prerendered — otherwise it freezes on the build day/week forever.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const goals = await listWeeklyGoalsForCurrentWeek()
  const stats = await getLifetimeStats()
  // Fetched before the branch, not inside it: S3 needs it too, to offer goals
  // that were left behind even though the week is not empty.
  const preview = await getMissingGoalsPreview()

  // Rendered above every state that has any history behind it, so the
  // accumulated total is the first thing a returning user sees.
  const banner = stats.totalCompleted > 0 ? <LifetimeProgressBanner {...stats} /> : null

  // S3 — the week is planned. The only branch that needs today's tasks.
  if (goals.length > 0) {
    const tasks = await listDailyTasksByDate(new Date())

    return (
      <main className="mx-auto max-w-2xl p-8 lg:max-w-6xl">
        {banner}
        <FluidDayWeek tasks={tasks} goals={goals} onToggleTask={toggleDailyTask} />
        {preview && (
          <div className="mt-6">
            <MissingGoalsCard preview={preview} onRepeat={repeatMissingGoals} />
          </div>
        )}
      </main>
    )
  }

  // S1 — nothing exists yet. `banner` is necessarily null here.
  if ((await countObjectives()) === 0) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <HomeEmptyState variant="no-objective" />
      </main>
    )
  }

  // S2 when something can be brought forward, S2b when nothing can.
  return (
    <main className="mx-auto max-w-2xl p-8">
      {banner}
      {preview ? (
        <ReturnEmptyState preview={preview} onRepeat={repeatMissingGoals} />
      ) : (
        <HomeEmptyState variant="no-goal" />
      )}
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

- [ ] **Step 3: Walk through all four states manually**

```bash
docker compose up -d
npm run dev
```

With the app open at `http://localhost:3000`:

1. **S1** — with an empty database, confirm the onboarding heading and that the CTA reaches `/objectives/new`. No banner.
2. **S2b** — create an objective and go back to `/`. Confirm "Defina a primeira meta semanal" and a link to `/objectives`, with no bring-forward button.
3. **S3** — add a weekly goal for the current week with tasks on a few days. Confirm the normal 60/40 layout returns. Check off a task and confirm the banner appears.
4. **S2** — edit that weekly goal (`/objectives/[id]/weeks/[weekId]/edit`) to move it to the previous week, then return to `/`. Confirm the card lists the goal with its task count and that clicking "Trazer para esta semana" rebuilds the week with every task unchecked and on the same weekday.
5. **S3 with something outstanding** — the interesting case. Create two goals in the previous week, bring only one forward by hand (create it in the current week with the same title under the same objective), then load `/`. Confirm the normal layout renders *and* a card below it offers only the other goal.
6. Click the bring-forward button twice in quick succession and confirm only one copy is created.

- [ ] **Step 4: Verify the production build**

```bash
npm run build
```

Expected: build succeeds, `/` still dynamic.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: resolve four home states with missing-goal recovery"
```

---

## Verification

Full check after all eight tasks:

```bash
npm test
npm run lint
npm run build
```

## Notes for the executor

- **`FluidDayWeek`'s "Nenhuma meta semanal para esta semana." branch becomes unreachable from `/`** after Task 8, because the component now only renders when `goals.length > 0`. Leave it in place — the component keeps its own standalone contract and its tests cover it. Do not delete it as dead code.
- **There is deliberately no "is the current week empty" guard.** An earlier revision of this plan had one; it was removed because it made the offer invisible in the case that matters most — a week that is partly planned. Idempotency comes from recomputing the missing set inside the transaction, which is strictly stronger.
- **The bring-forward button has no confirmation dialog and no per-goal selection.** Rejected in the spec: the list carries the same information without adding a step, and an unwanted goal can be deleted from `/objectives/[id]` in one click.
- **`repeatMissingGoals` takes no arguments.** It resolves the source week and the missing set itself, so the client never sends anything it could get wrong or tamper with.
