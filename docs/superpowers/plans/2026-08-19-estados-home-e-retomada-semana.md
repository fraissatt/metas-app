# Home States and Week Resumption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single dead-end empty state on the home page (`"Nenhuma tarefa para hoje."`) with four distinct states, the most important being a return screen that rebuilds the current week from the most recent week that had goals in one click.

**Architecture:** Two new read queries (`countObjectives`, `getLastWeekPreview`) and one transactional write (`repeatLastWeek`) join the existing action modules. `src/app/page.tsx` — already a Server Component doing all the fetching — resolves which of the four states applies and renders one of three presentational components; the client components stay unaware that states exist. The clone preserves weekday position by calendar-day offset and guards against double submission inside its own transaction.

**Tech Stack:** Next.js 16 (App Router, Server Components, Server Actions), Prisma 6 + Postgres, Tailwind v4 with tokens from `globals.css`, shadcn/ui on Base UI, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-19-progresso-acumulado-e-retomada-design.md`

**Depends on:** `docs/superpowers/plans/2026-08-19-faixa-progresso-vitalicio.md` — Task 7 renders `LifetimeProgressBanner` and calls `getLifetimeStats`, both built there. Do not start this plan until that one is merged.

## Global Constraints

- **`getWeekBounds`** (`src/lib/dates.ts:3`) is the only authority on when a week starts. No raw SQL, no hand-rolled Monday math.
- **No schema change and no migration.**
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

### Task 2: `getLastWeekPreview`

**Files:**
- Modify: `src/lib/actions/weeklyGoals.ts` (append after `listWeeklyGoalsForCurrentWeek`, line 62)
- Test: `src/lib/actions/weeklyGoals.test.ts` (append cases inside the existing `describe('weekly goal actions', …)`)

**Interfaces:**
- Consumes: `getWeekBounds` from `@/lib/dates`; `prisma` from `@/lib/db`
- Produces: `export type LastWeekPreview = { sourceWeekStart: Date; goals: Array<{ id: string; title: string; taskCount: number }> }`
- Produces: `export async function getLastWeekPreview(): Promise<LastWeekPreview | null>`
- Produces (module-private, used by Task 3): `async function findSourceWeekStart(currentWeekStart: Date): Promise<Date | null>`

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('weekly goal actions', () => { … })` block in `src/lib/actions/weeklyGoals.test.ts`, and add `getLastWeekPreview` to the existing import list (lines 4-12):

```ts
  it('returns no preview when only the current week has goals', async () => {
    const objective = await makeObjective()
    await prisma.weeklyGoal.create({
      data: { title: 'Atual', objectiveId: objective.id, ...getWeekBounds(new Date()) },
    })

    expect(await getLastWeekPreview()).toBeNull()
  })

  it('returns no preview when there are no weekly goals at all', async () => {
    await makeObjective()

    expect(await getLastWeekPreview()).toBeNull()
  })

  it('previews the most recent earlier week, skipping empty weeks in between', async () => {
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

    const preview = await getLastWeekPreview()

    expect(preview?.sourceWeekStart).toEqual(oneWeekAgo.weekStart)
    expect(preview?.goals.map((g) => g.title)).toEqual(['Recente'])
  })

  it('counts each previewed goal\'s tasks and orders goals by title', async () => {
    const objective = await makeObjective()
    const lastWeek = getWeekBounds(addWeeks(getWeekBounds(new Date()).weekStart, -1))

    const zebra = await prisma.weeklyGoal.create({
      data: { title: 'Zebra', objectiveId: objective.id, ...lastWeek },
    })
    const alfa = await prisma.weeklyGoal.create({
      data: { title: 'Alfa', objectiveId: objective.id, ...lastWeek },
    })
    await prisma.dailyTask.createMany({
      data: [
        { title: 'T1', weeklyGoalId: alfa.id, date: lastWeek.weekStart },
        { title: 'T2', weeklyGoalId: alfa.id, date: lastWeek.weekStart },
        { title: 'T3', weeklyGoalId: zebra.id, date: lastWeek.weekStart },
      ],
    })

    const preview = await getLastWeekPreview()

    // Alphabetical, not insertion order: without an explicit `orderBy` Postgres
    // returns rows in an unspecified order and the preview list would reshuffle
    // between renders of identical data.
    expect(preview?.goals).toEqual([
      { id: alfa.id, title: 'Alfa', taskCount: 2 },
      { id: zebra.id, title: 'Zebra', taskCount: 1 },
    ])
  })
```

Add `addWeeks` to the existing `date-fns` import on line 2 (it currently imports only `format`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`
Expected: FAIL — `getLastWeekPreview is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/actions/weeklyGoals.ts`:

```ts
export type LastWeekPreview = {
  sourceWeekStart: Date
  goals: Array<{ id: string; title: string; taskCount: number }>
}

/**
 * The most recent week that actually had goals — not simply the previous
 * calendar week. Someone who has been away three weeks would find the
 * preceding week empty, and that is exactly the user this exists for.
 *
 * Not exported: this module is `'use server'`, where every export becomes a
 * callable server action.
 */
async function findSourceWeekStart(currentWeekStart: Date): Promise<Date | null> {
  const previous = await prisma.weeklyGoal.findFirst({
    where: { weekStart: { lt: currentWeekStart } },
    orderBy: { weekStart: 'desc' },
    select: { weekStart: true },
  })

  return previous?.weekStart ?? null
}

export async function getLastWeekPreview(): Promise<LastWeekPreview | null> {
  const { weekStart: currentWeekStart } = getWeekBounds(new Date())
  const sourceWeekStart = await findSourceWeekStart(currentWeekStart)
  if (!sourceWeekStart) return null

  const goals = await prisma.weeklyGoal.findMany({
    where: { weekStart: sourceWeekStart },
    orderBy: { title: 'asc' },
    select: { id: true, title: true, _count: { select: { dailyTasks: true } } },
  })

  return {
    sourceWeekStart,
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      taskCount: goal._count.dailyTasks,
    })),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`
Expected: PASS, existing cases plus the four new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/weeklyGoals.ts src/lib/actions/weeklyGoals.test.ts
git commit -m "feat: add getLastWeekPreview action"
```

---

### Task 3: `repeatLastWeek`

**Files:**
- Modify: `src/lib/actions/weeklyGoals.ts` (append after `getLastWeekPreview`)
- Test: `src/lib/actions/weeklyGoals.test.ts` (append cases inside the same `describe`)

**Interfaces:**
- Consumes: `findSourceWeekStart` (Task 2, module-private); `getWeekBounds`; `prisma`; `revalidatePath` from `next/cache`
- Produces: `export async function repeatLastWeek(): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Append inside the same `describe` block in `src/lib/actions/weeklyGoals.test.ts`, adding `repeatLastWeek` to the import list and `addDays` / `differenceInCalendarDays` to the `date-fns` import:

```ts
  it('clones last week\'s goals and tasks into the current week, reset to incomplete', async () => {
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

    await repeatLastWeek()

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

  it('lands each cloned task on the same weekday it had in the source week', async () => {
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

    await repeatLastWeek()

    const [created] = await prisma.weeklyGoal.findMany({
      where: { weekStart: currentWeekStart },
      include: { dailyTasks: { orderBy: { date: 'asc' } } },
    })

    expect(differenceInCalendarDays(created.dailyTasks[0].date, currentWeekStart)).toBe(1)
    expect(differenceInCalendarDays(created.dailyTasks[1].date, currentWeekStart)).toBe(5)
  })

  it('does nothing when the current week already has a goal', async () => {
    const objective = await makeObjective()
    const currentWeek = getWeekBounds(new Date())
    const lastWeek = getWeekBounds(addWeeks(currentWeek.weekStart, -1))
    await prisma.weeklyGoal.create({
      data: { title: 'Da semana passada', objectiveId: objective.id, ...lastWeek },
    })
    await prisma.weeklyGoal.create({
      data: { title: 'Já existe', objectiveId: objective.id, ...currentWeek },
    })

    await repeatLastWeek()

    const current = await prisma.weeklyGoal.findMany({ where: { weekStart: currentWeek.weekStart } })

    expect(current.map((g) => g.title)).toEqual(['Já existe'])
  })

  it('does nothing when there is no earlier week to repeat', async () => {
    await makeObjective()

    await repeatLastWeek()

    expect(await prisma.weeklyGoal.findMany()).toHaveLength(0)
  })

  it('clones goals from several objectives in the same source week', async () => {
    const first = await makeObjective()
    const second = await prisma.objective.create({
      data: { title: 'Outro', startDate: new Date() },
    })
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const lastWeek = getWeekBounds(addWeeks(currentWeekStart, -1))
    await prisma.weeklyGoal.create({ data: { title: 'A', objectiveId: first.id, ...lastWeek } })
    await prisma.weeklyGoal.create({ data: { title: 'B', objectiveId: second.id, ...lastWeek } })

    await repeatLastWeek()

    const created = await prisma.weeklyGoal.findMany({ where: { weekStart: currentWeekStart } })

    expect(created).toHaveLength(2)
    expect(new Set(created.map((g) => g.objectiveId))).toEqual(new Set([first.id, second.id]))
  })

  it('clones a goal that has no tasks', async () => {
    const objective = await makeObjective()
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const lastWeek = getWeekBounds(addWeeks(currentWeekStart, -1))
    await prisma.weeklyGoal.create({
      data: { title: 'Vazia', objectiveId: objective.id, ...lastWeek },
    })

    await repeatLastWeek()

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
Expected: FAIL — `repeatLastWeek is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/actions/weeklyGoals.ts`, and add `addDays` and `differenceInCalendarDays` to the file's imports (the file currently imports nothing from `date-fns`):

```ts
export async function repeatLastWeek(): Promise<void> {
  const { weekStart: currentWeekStart, weekEnd: currentWeekEnd } = getWeekBounds(new Date())
  const sourceWeekStart = await findSourceWeekStart(currentWeekStart)
  if (!sourceWeekStart) return

  const sourceGoals = await prisma.weeklyGoal.findMany({
    where: { weekStart: sourceWeekStart },
    include: { dailyTasks: true },
  })

  await prisma.$transaction(async (tx) => {
    // Re-checked inside the transaction rather than before it: two rapid
    // clicks (or a retry) would otherwise both pass an outside check and
    // create the week twice.
    const alreadyPlanned = await tx.weeklyGoal.count({ where: { weekStart: currentWeekStart } })
    if (alreadyPlanned > 0) return

    for (const goal of sourceGoals) {
      // `completed` and `completedAt` are left to their schema defaults
      // (false / null) — a repeated week starts unfinished.
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
          date: addDays(currentWeekStart, differenceInCalendarDays(task.date, sourceWeekStart)),
        })),
      })
    }
  })

  revalidatePath('/')
  for (const objectiveId of new Set(sourceGoals.map((goal) => goal.objectiveId))) {
    revalidatePath(`/objectives/${objectiveId}`)
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`
Expected: PASS, all existing cases plus the six new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/weeklyGoals.ts src/lib/actions/weeklyGoals.test.ts
git commit -m "feat: add repeatLastWeek action"
```

---

### Task 4: `HomeEmptyState` component

**Files:**
- Create: `src/components/home-empty-state.tsx`
- Test: `src/components/home-empty-state.test.tsx`

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`
- Produces: `export function HomeEmptyState({ variant }: { variant: 'no-objective' | 'no-goal' }): JSX.Element`

Covers S1 (no objective exists) and S2b (an objective exists but no weekly goal ever did). The two differ only in copy and CTA target.

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

### Task 5: `ReturnEmptyState` component

**Files:**
- Create: `src/components/return-empty-state.tsx`
- Test: `src/components/return-empty-state.test.tsx`

**Interfaces:**
- Consumes: `LastWeekPreview` from `@/lib/actions/weeklyGoals` (Task 2, type-only import); `Button` from `@/components/ui/button`
- Produces: `export function ReturnEmptyState({ preview, onRepeat }: { preview: LastWeekPreview; onRepeat: () => Promise<void> }): JSX.Element`

A client component: the repeat button needs a pending state while the server action runs, following the `useTransition` pattern in `src/components/task-toggle.tsx:15`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/return-empty-state.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReturnEmptyState } from '@/components/return-empty-state'

const preview = {
  sourceWeekStart: new Date(2026, 7, 10), // Monday 10/08
  goals: [
    { id: 'goal-a', title: 'Revisar orçamento', taskCount: 4 },
    { id: 'goal-b', title: 'Praticar inglês', taskCount: 1 },
  ],
}

describe('ReturnEmptyState', () => {
  it('lists each goal from the source week with its task count', () => {
    render(<ReturnEmptyState preview={preview} onRepeat={vi.fn()} />)

    expect(screen.getByText('Revisar orçamento')).toBeInTheDocument()
    expect(screen.getByText('4 tarefas')).toBeInTheDocument()
    expect(screen.getByText('Praticar inglês')).toBeInTheDocument()
    expect(screen.getByText('1 tarefa')).toBeInTheDocument()
  })

  it('names the week being repeated', () => {
    render(<ReturnEmptyState preview={preview} onRepeat={vi.fn()} />)

    expect(screen.getByText('Semana de 10/08')).toBeInTheDocument()
  })

  it('calls onRepeat once when the primary button is clicked', async () => {
    const onRepeat = vi.fn().mockResolvedValue(undefined)
    render(<ReturnEmptyState preview={preview} onRepeat={onRepeat} />)

    await userEvent.click(screen.getByRole('button', { name: /repetir/i }))

    expect(onRepeat).toHaveBeenCalledTimes(1)
  })

  it('offers a way to build the week from scratch instead', () => {
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
'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { format } from 'date-fns'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LastWeekPreview } from '@/lib/actions/weeklyGoals'

export function ReturnEmptyState({
  preview,
  onRepeat,
}: {
  preview: LastWeekPreview
  onRepeat: () => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <section className="mx-auto flex max-w-sm flex-col gap-4 py-12">
      <p className="text-center text-sm text-muted-foreground">Sua semana ainda está vazia.</p>

      {/* Shown before the click rather than behind a confirmation step: it
          tells the user what the button will do and, just as importantly,
          reminds them what they had committed to. */}
      <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
        <span className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Semana de {format(preview.sourceWeekStart, 'dd/MM')}
        </span>
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
        {isPending ? 'Recriando…' : 'Repetir essa semana'}
      </Button>

      <Button variant="outline" nativeButton={false} render={<Link href="/objectives" />}>
        + Nova meta semanal
      </Button>
    </section>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/return-empty-state.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/return-empty-state.tsx src/components/return-empty-state.test.tsx
git commit -m "feat: add ReturnEmptyState component"
```

---

### Task 6: Give the "no tasks today" state a way forward

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

### Task 7: Resolve the four home states

**Files:**
- Modify: `src/app/page.tsx` (whole file)

**Interfaces:**
- Consumes: `countObjectives` (Task 1); `getLastWeekPreview`, `repeatLastWeek` (Tasks 2-3); `HomeEmptyState` (Task 4); `ReturnEmptyState` (Task 5); `getLifetimeStats` and `LifetimeProgressBanner` from the prerequisite plan
- Produces: nothing new

No automated test — `src/app/` has no page-level tests and this plan does not introduce a page-testing setup. Verification is the full suite plus the manual walkthrough in Step 3, which exercises all four states.

- [ ] **Step 1: Rewrite `src/app/page.tsx`**

```tsx
import { listDailyTasksByDate, toggleDailyTask } from '@/lib/actions/dailyTasks'
import { countObjectives } from '@/lib/actions/objectives'
import { getLifetimeStats } from '@/lib/actions/stats'
import {
  getLastWeekPreview,
  listWeeklyGoalsForCurrentWeek,
  repeatLastWeek,
} from '@/lib/actions/weeklyGoals'
import { FluidDayWeek } from '@/components/fluid-day-week'
import { HomeEmptyState } from '@/components/home-empty-state'
import { LifetimeProgressBanner } from '@/components/lifetime-progress-banner'
import { ReturnEmptyState } from '@/components/return-empty-state'

// This page's correctness depends on the wall clock at request time (it
// filters tasks by "today" and computes "the current week" from `new
// Date()`), so it must never be statically prerendered — otherwise it freezes on the build day/week forever.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const goals = await listWeeklyGoalsForCurrentWeek()
  const stats = await getLifetimeStats()

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

  // S2 when an earlier week exists to repeat, S2b when it does not.
  const preview = await getLastWeekPreview()

  return (
    <main className="mx-auto max-w-2xl p-8">
      {banner}
      {preview ? (
        <ReturnEmptyState preview={preview} onRepeat={repeatLastWeek} />
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
2. **S2b** — create an objective and go back to `/`. Confirm "Defina a primeira meta semanal" and a link to `/objectives`, with no repeat button.
3. **S3** — add a weekly goal for the current week with tasks on a few days. Confirm the normal 60/40 layout returns. Check off a task and confirm the banner appears.
4. **S2** — edit that weekly goal (`/objectives/[id]/weeks/[weekId]/edit`) to move it to the previous week, then return to `/`. Confirm the preview lists the goal with its task count, the button reads "Repetir essa semana", and clicking it rebuilds the current week with every task unchecked and on the same weekday.
5. Click the repeat button twice in quick succession and confirm only one copy of the week is created.

- [ ] **Step 4: Verify the production build**

```bash
npm run build
```

Expected: build succeeds, `/` still dynamic.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: resolve four home states with week resumption"
```

---

## Verification

Full check after all seven tasks:

```bash
npm test
npm run lint
npm run build
```

## Notes for the executor

- **`FluidDayWeek`'s "Nenhuma meta semanal para esta semana." branch becomes unreachable from `/`** after Task 7, because the component now only renders when `goals.length > 0`. Leave it in place — the component keeps its own standalone contract and its tests cover it. Do not delete it as dead code.
- **The repeat button deliberately has no confirmation dialog and no per-goal selection.** That was considered and rejected in the spec: the preview carries the same information without adding a step, and an unwanted goal can be deleted from `/objectives/[id]` in one click.
- **`repeatLastWeek` takes no arguments.** It resolves the source week itself so the client never sends a week identifier it could get wrong or tamper with.
- A user who already has one goal this week and wants three more from last week is knowingly not served — the spec lists partial repeat as a non-goal.
