# Weekly Goal Recurrence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a weekly goal carry itself forward, so a routine that runs for two years is typed once instead of 104 times.

**Architecture:** One boolean column on `WeeklyGoal`. The previous week's tasks are the template — no weekday storage, no series entity. `findMissingGoals`, already built for the bring-forward button, gains the objective's status and becomes the shared source for two opposite slices: recurring goals get materialised automatically, one-off goals get offered manually. Materialisation runs from a client effect, never during render, because the sidebar's prefetched link to `/` would otherwise create the week on hover.

**Tech Stack:** Next.js 16 (App Router, Server Components, Server Actions), Prisma 6 + Postgres, Tailwind v4 with tokens from `globals.css`, shadcn/ui on Base UI, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-19-recorrencia-de-metas-design.md`

**Depends on:** `docs/superpowers/plans/2026-08-19-estados-home-e-retomada-semana.md` — this plan extends `findMissingGoals`, `getMissingGoalsPreview`, `repeatMissingGoals`, and the four-state `page.tsx` built there. Starting this first would mean building all of them twice.

## Global Constraints

- **Mutations must never run during render.** From `node_modules/next/dist/docs/01-app/02-guides/data-security.md:569`: "Mutations […] should never be a side-effect, either in Server or Client Components." And `02-guides/prefetching.md:218` says to move side-effects "to a `useEffect` hook or a Server Action triggered from a Client Component". `src/components/sidebar.tsx:9` renders `<Link href="/">`, which Next prefetches — materialising inside `page.tsx` would create the week on pointer hover.
- **A clone must carry `recurring` forward,** or the chain stops after one week.
- **A goal's identity across weeks is the `objectiveId` + `title` pair.** Never match on title alone.
- **`getWeekBounds`** (`src/lib/dates.ts:3`, `weekStartsOn: 1`) stays the authority on week boundaries. No raw SQL, no hand-rolled Monday math.
- **Only the current week is materialised.** No back-filling of missed weeks — those are over, and filling them with unchecked tasks would manufacture failure.
- Style only with existing design tokens (`bg-secondary`, `border-border`, `text-primary`, `text-muted-foreground`). No hardcoded colors.
- All UI copy is Portuguese (pt-BR).
- Tests: Vitest + Testing Library, plain fixtures, `vi.fn()` only. DB tests hit `metas_app_test`; `src/test/setup.ts` truncates all three tables after each test.
- Run a single file with `npx vitest run <path>`, the full suite with `npm test`. Test DB must be up (`docker compose up -d`) and migrated (`npm run test:migrate`).
- **`'use server'` files may only export async functions.** Types may be exported; synchronous helpers must stay unexported.

---

### Task 1: The `recurring` column and its persistence

**Files:**
- Modify: `prisma/schema.prisma:21-30`
- Create: `prisma/migrations/<generated>/migration.sql` (produced by the Prisma CLI, not hand-written)
- Modify: `src/lib/actions/validation.ts` (append)
- Modify: `src/lib/actions/weeklyGoals.ts:11-16` (`readWeeklyGoalFields`)
- Test: `src/lib/actions/validation.test.ts`, `src/lib/actions/weeklyGoals.test.ts`

**Interfaces:**
- Produces: `export function readCheckbox(formData: FormData, field: string): boolean`
- Produces: `readWeeklyGoalFields` now returns `{ title, weekStart, weekEnd, recurring }`, so `createWeeklyGoal` and `updateWeeklyGoal` persist the flag with no further change

- [ ] **Step 1: Add the column to the schema**

In `prisma/schema.prisma`, add one field to `model WeeklyGoal`, after `status`:

```prisma
  recurring Boolean @default(false)
```

`@default(false)` means every existing row keeps today's behaviour, so the migration needs no data step.

- [ ] **Step 2: Generate and apply the migration**

```bash
docker compose up -d
npx prisma migrate dev --name weekly_goal_recurring
npm run test:migrate
```

Expected: a new folder under `prisma/migrations/` containing `ALTER TABLE "WeeklyGoal" ADD COLUMN "recurring" BOOLEAN NOT NULL DEFAULT false;`, applied to both databases.

- [ ] **Step 3: Write the failing tests**

Append to `src/lib/actions/validation.test.ts`:

```ts
describe('readCheckbox', () => {
  it('is true when the field is present', () => {
    const fd = new FormData()
    fd.set('recurring', 'on')

    expect(readCheckbox(fd, 'recurring')).toBe(true)
  })

  it('is false when the field is absent', () => {
    // An unchecked checkbox submits nothing at all — that absence is the
    // whole signal, which is why this reads presence rather than a value.
    expect(readCheckbox(new FormData(), 'recurring')).toBe(false)
  })
})
```

Add `readCheckbox` to that file's import from `@/lib/actions/validation`.

Append inside the existing `describe('weekly goal actions', …)` block in `src/lib/actions/weeklyGoals.test.ts`:

```ts
  it('persists recurring when the checkbox was submitted', async () => {
    const objective = await makeObjective()

    await createWeeklyGoal(
      objective.id,
      formData({ title: 'Academia', weekOf: '2026-08-17', recurring: 'on' }),
    )

    const [goal] = await prisma.weeklyGoal.findMany()
    expect(goal.recurring).toBe(true)
  })

  it('defaults recurring to false when the checkbox was not submitted', async () => {
    const objective = await makeObjective()

    await createWeeklyGoal(objective.id, formData({ title: 'Pontual', weekOf: '2026-08-17' }))

    const [goal] = await prisma.weeklyGoal.findMany()
    expect(goal.recurring).toBe(false)
  })

  it('turns recurrence off again on update', async () => {
    const objective = await makeObjective()
    const goal = await prisma.weeklyGoal.create({
      data: {
        title: 'Academia',
        objectiveId: objective.id,
        recurring: true,
        ...getWeekBounds(new Date()),
      },
    })

    await updateWeeklyGoal(goal.id, formData({ title: 'Academia', weekOf: '2026-08-17' }))

    const updated = await prisma.weeklyGoal.findUniqueOrThrow({ where: { id: goal.id } })
    expect(updated.recurring).toBe(false)
  })
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/lib/actions/validation.test.ts src/lib/actions/weeklyGoals.test.ts`
Expected: FAIL — `readCheckbox is not a function`, and the persistence cases report `recurring` as `false` when it should be `true`.

- [ ] **Step 5: Write the implementation**

Append to `src/lib/actions/validation.ts`:

```ts
/**
 * Reads a checkbox field. An unchecked checkbox submits nothing at all, so
 * presence is the signal — the submitted value ("on", or whatever `value` the
 * control carries) is irrelevant.
 */
export function readCheckbox(formData: FormData, field: string): boolean {
  return formData.get(field) !== null
}
```

In `src/lib/actions/weeklyGoals.ts`, add `readCheckbox` to the import from `@/lib/actions/validation` and change `readWeeklyGoalFields` (lines 11-16) to:

```ts
function readWeeklyGoalFields(formData: FormData) {
  const title = readTitle(formData)
  const { weekStart, weekEnd } = getWeekBounds(readDate(formData, 'weekOf'))
  const recurring = readCheckbox(formData, 'recurring')

  return { title, weekStart, weekEnd, recurring }
}
```

Both `createWeeklyGoal` and `updateWeeklyGoal` spread this result already, so they need no change.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/actions/validation.test.ts src/lib/actions/weeklyGoals.test.ts`
Expected: PASS, all cases.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/actions/validation.ts src/lib/actions/validation.test.ts src/lib/actions/weeklyGoals.ts src/lib/actions/weeklyGoals.test.ts
git commit -m "feat: add recurring flag to weekly goals"
```

---

### Task 2: The recurrence checkbox on the weekly goal form

**Files:**
- Modify: `src/components/weekly-goal-form.tsx` (whole file)
- Modify: `src/app/objectives/[id]/weeks/[weekId]/edit/page.tsx:24-27`
- Test: `src/components/weekly-goal-form.test.tsx`

**Interfaces:**
- Consumes: `Checkbox` from `@/components/ui/checkbox`
- Produces: `WeeklyGoalForm`'s `defaultValues` widens from `{ title: string; weekOf: string }` to `{ title: string; weekOf: string; recurring?: boolean }`

The form is used by both `AddWeeklyGoalCard` (`src/components/add-weekly-goal-card.tsx:32`) and the edit page, so create and edit are both covered by this one change. `AddWeeklyGoalCard` passes no `defaultValues`, so a new goal starts non-recurring.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('WeeklyGoalForm', …)` block in `src/components/weekly-goal-form.test.tsx`:

```tsx
  it('submits recurring when the box is checked', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(<WeeklyGoalForm action={action} />)

    await userEvent.type(screen.getByLabelText(/título/i), 'Academia')
    await userEvent.type(screen.getByLabelText(/semana de/i), '2026-08-17')
    await userEvent.click(screen.getByRole('checkbox', { name: /repetir toda semana/i }))
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    const submitted = action.mock.calls[0][0] as FormData
    expect(submitted.get('recurring')).not.toBeNull()
  })

  it('omits recurring when the box is left unchecked', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(<WeeklyGoalForm action={action} />)

    await userEvent.type(screen.getByLabelText(/título/i), 'Pontual')
    await userEvent.type(screen.getByLabelText(/semana de/i), '2026-08-17')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    const submitted = action.mock.calls[0][0] as FormData
    expect(submitted.get('recurring')).toBeNull()
  })

  it('starts checked when editing a goal that already recurs', () => {
    render(
      <WeeklyGoalForm
        action={vi.fn()}
        defaultValues={{ title: 'Academia', weekOf: '2026-08-17', recurring: true }}
      />,
    )

    expect(screen.getByRole('checkbox', { name: /repetir toda semana/i })).toBeChecked()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/weekly-goal-form.test.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "checkbox" and name /repetir toda semana/i`.

- [ ] **Step 3: Write the implementation**

Replace the whole of `src/components/weekly-goal-form.tsx`:

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function WeeklyGoalForm({
  action,
  defaultValues,
}: {
  action: (formData: FormData) => Promise<void>
  defaultValues?: { title: string; weekOf: string; recurring?: boolean }
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required defaultValue={defaultValues?.title} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="weekOf">Semana de</Label>
        <Input
          id="weekOf"
          name="weekOf"
          type="date"
          required
          defaultValue={defaultValues?.weekOf}
        />
      </div>
      {/* `aria-label` rather than a `Label htmlFor`, matching how the day
          pickers in `weekly-goal-card.tsx` label their Base UI checkboxes. */}
      <div className="flex items-center gap-2">
        <Checkbox
          name="recurring"
          aria-label="Repetir toda semana"
          defaultChecked={defaultValues?.recurring}
        />
        <span className="text-sm">Repetir toda semana</span>
      </div>
      <Button type="submit">Salvar</Button>
    </form>
  )
}
```

In `src/app/objectives/[id]/weeks/[weekId]/edit/page.tsx`, add `recurring` to the `defaultValues` (currently line 26):

```tsx
        defaultValues={{
          title: goal.title,
          weekOf: format(goal.weekStart, 'yyyy-MM-dd'),
          recurring: goal.recurring,
        }}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/weekly-goal-form.test.tsx`
Expected: PASS, existing case plus the three new ones.

- [ ] **Step 5: Commit**

```bash
git add src/components/weekly-goal-form.tsx src/components/weekly-goal-form.test.tsx "src/app/objectives/[id]/weeks/[weekId]/edit/page.tsx"
git commit -m "feat: add recurrence checkbox to the weekly goal form"
```

---

### Task 3: Show that a goal recurs

**Files:**
- Modify: `src/components/weekly-goal-card.tsx:44-50`
- Test: `src/components/weekly-goal-card.test.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new

Without this the flag is invisible unless you open the edit form, so a user cannot tell why a goal reappeared.

- [ ] **Step 1: Write the failing tests**

In `src/components/weekly-goal-card.test.tsx`, add `recurring: false` to the `baseGoal` fixture (it now fails to typecheck without it), then append inside the existing `describe('WeeklyGoalCard', …)` block:

```tsx
  it('marks a goal that repeats every week', () => {
    render(
      <WeeklyGoalCard
        goal={{ ...baseGoal, recurring: true }}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByText('repete toda semana')).toBeInTheDocument()
  })

  it('does not mark a one-off goal', () => {
    render(
      <WeeklyGoalCard
        goal={baseGoal}
        expanded={false}
        onToggleExpand={vi.fn()}
        onCreateTasks={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.queryByText('repete toda semana')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/weekly-goal-card.test.tsx`
Expected: FAIL — `Unable to find an element with the text: repete toda semana`.

- [ ] **Step 3: Write the implementation**

In `src/components/weekly-goal-card.tsx`, replace the `CardHeader` block (currently lines 46-50):

```tsx
      <CardHeader className="pb-2">
        <CardTitle>
          <Link href={`/objectives/${goal.objectiveId}/weeks/${goal.id}`}>{goal.title}</Link>
        </CardTitle>
      </CardHeader>
```

with:

```tsx
      <CardHeader className="pb-2">
        <CardTitle>
          <Link href={`/objectives/${goal.objectiveId}/weeks/${goal.id}`}>{goal.title}</Link>
        </CardTitle>
        {goal.recurring && (
          <span className="w-fit rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            repete toda semana
          </span>
        )}
      </CardHeader>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/weekly-goal-card.test.tsx`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/components/weekly-goal-card.tsx src/components/weekly-goal-card.test.tsx
git commit -m "feat: show which weekly goals repeat"
```

---

### Task 4: Partition the missing set into recurring and one-off

**Files:**
- Modify: `src/lib/actions/weeklyGoals.ts` (`findMissingGoals`, `getMissingGoalsPreview`, `repeatMissingGoals`)
- Test: `src/lib/actions/weeklyGoals.test.ts`

**Interfaces:**
- Consumes: `findMissingGoals` from the prerequisite plan
- Produces (module-private): `type SourceGoal = WeeklyGoal & { dailyTasks: DailyTask[]; objective: { status: Status } }`
- Produces (module-private): `function oneOffGoals(goals: SourceGoal[]): SourceGoal[]`
- Produces (module-private): `function pendingRecurrences(goals: SourceGoal[]): SourceGoal[]`

Recurring goals must disappear from the manual offer, or during the moment between first render and materialisation the user is invited to do by hand what is about to happen anyway.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('weekly goal actions', …)` block:

```ts
  it('does not offer a recurring goal for manual bring-forward', async () => {
    const objective = await makeObjective()
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const lastWeek = getWeekBounds(addWeeks(currentWeekStart, -1))

    await prisma.weeklyGoal.create({
      data: { title: 'Academia', objectiveId: objective.id, recurring: true, ...lastWeek },
    })

    // It is materialised automatically instead — offering it too would ask the
    // user to do by hand what is about to happen on its own.
    expect(await getMissingGoalsPreview()).toBeNull()
  })

  it('offers only the one-off goals when the source week mixes both', async () => {
    const objective = await makeObjective()
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const lastWeek = getWeekBounds(addWeeks(currentWeekStart, -1))

    await prisma.weeklyGoal.create({
      data: { title: 'Academia', objectiveId: objective.id, recurring: true, ...lastWeek },
    })
    await prisma.weeklyGoal.create({
      data: { title: 'Revisar orçamento', objectiveId: objective.id, ...lastWeek },
    })

    const preview = await getMissingGoalsPreview()

    expect(preview?.goals.map((g) => g.title)).toEqual(['Revisar orçamento'])
  })

  it('leaves recurring goals alone when bringing missing goals forward', async () => {
    const objective = await makeObjective()
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const lastWeek = getWeekBounds(addWeeks(currentWeekStart, -1))

    await prisma.weeklyGoal.create({
      data: { title: 'Academia', objectiveId: objective.id, recurring: true, ...lastWeek },
    })
    await prisma.weeklyGoal.create({
      data: { title: 'Revisar orçamento', objectiveId: objective.id, ...lastWeek },
    })

    await repeatMissingGoals()

    const current = await prisma.weeklyGoal.findMany({ where: { weekStart: currentWeekStart } })

    expect(current.map((g) => g.title)).toEqual(['Revisar orçamento'])
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`
Expected: FAIL — the preview still returns the recurring goal, and `repeatMissingGoals` clones both.

- [ ] **Step 3: Write the implementation**

In `src/lib/actions/weeklyGoals.ts`, add `Status` to the type import from `@prisma/client`, then:

Replace the `SourceGoal` type with:

```ts
type SourceGoal = WeeklyGoal & { dailyTasks: DailyTask[]; objective: { status: Status } }
```

In `findMissingGoals`, change the source-week query's `include` to carry the objective's status:

```ts
    db.weeklyGoal.findMany({
      where: { weekStart: previous.weekStart },
      orderBy: { title: 'asc' },
      include: { dailyTasks: true, objective: { select: { status: true } } },
    }),
```

Add the two slices, next to `findMissingGoals`:

```ts
/** Goals the user plans week by week — offered manually, never materialised. */
function oneOffGoals(goals: SourceGoal[]): SourceGoal[] {
  return goals.filter((goal) => !goal.recurring)
}

/**
 * Goals that should reappear on their own. A completed objective stops
 * generating: its weeks are finished, and quietly recreating them would undo
 * the user's decision that it was done.
 */
function pendingRecurrences(goals: SourceGoal[]): SourceGoal[] {
  return goals.filter((goal) => goal.recurring && goal.objective.status !== 'COMPLETED')
}
```

In `getMissingGoalsPreview`, run the result through `oneOffGoals` before the emptiness check:

```ts
export async function getMissingGoalsPreview(): Promise<MissingGoalsPreview | null> {
  const { weekStart: currentWeekStart } = getWeekBounds(new Date())
  const missing = await findMissingGoals(currentWeekStart)
  if (!missing) return null

  const goals = oneOffGoals(missing.goals)
  if (goals.length === 0) return null

  return {
    sourceWeekStart: missing.sourceWeekStart,
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      taskCount: goal.dailyTasks.length,
    })),
  }
}
```

In `repeatMissingGoals`, apply the same slice inside the transaction:

```ts
    const missing = await findMissingGoals(currentWeekStart, tx)
    if (!missing) return

    const goals = oneOffGoals(missing.goals)
    if (goals.length === 0) return

    touchedObjectiveIds = [...new Set(goals.map((goal) => goal.objectiveId))]
```

and iterate `goals` rather than `missing.goals` in the cloning loop.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`
Expected: PASS, all cases including the ones written in the prerequisite plan.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/weeklyGoals.ts src/lib/actions/weeklyGoals.test.ts
git commit -m "feat: split missing goals into recurring and one-off"
```

---

### Task 5: `countPendingRecurrences`

**Files:**
- Modify: `src/lib/actions/weeklyGoals.ts` (append)
- Test: `src/lib/actions/weeklyGoals.test.ts`

**Interfaces:**
- Consumes: `findMissingGoals`, `pendingRecurrences` (Task 4)
- Produces: `export async function countPendingRecurrences(): Promise<number>`

A pure read with no side effects, so it is safe to call during render and safe to prefetch. It is what lets `page.tsx` render the materialiser only when there is something to do, instead of firing a POST on every home visit.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe` block, adding `countPendingRecurrences` to the import list:

```ts
  it('counts recurring goals with no counterpart this week', async () => {
    const objective = await makeObjective()
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const lastWeek = getWeekBounds(addWeeks(currentWeekStart, -1))

    await prisma.weeklyGoal.create({
      data: { title: 'Academia', objectiveId: objective.id, recurring: true, ...lastWeek },
    })
    await prisma.weeklyGoal.create({
      data: { title: 'Pontual', objectiveId: objective.id, ...lastWeek },
    })

    expect(await countPendingRecurrences()).toBe(1)
  })

  it('counts nothing once the recurring goal already has a counterpart', async () => {
    const objective = await makeObjective()
    const currentWeek = getWeekBounds(new Date())
    const lastWeek = getWeekBounds(addWeeks(currentWeek.weekStart, -1))

    await prisma.weeklyGoal.create({
      data: { title: 'Academia', objectiveId: objective.id, recurring: true, ...lastWeek },
    })
    await prisma.weeklyGoal.create({
      data: { title: 'Academia', objectiveId: objective.id, recurring: true, ...currentWeek },
    })

    expect(await countPendingRecurrences()).toBe(0)
  })

  it('counts nothing for a recurring goal under a completed objective', async () => {
    const objective = await prisma.objective.create({
      data: {
        title: 'Terminado',
        startDate: new Date(),
        status: 'COMPLETED',
      },
    })
    const lastWeek = getWeekBounds(addWeeks(getWeekBounds(new Date()).weekStart, -1))

    await prisma.weeklyGoal.create({
      data: { title: 'Academia', objectiveId: objective.id, recurring: true, ...lastWeek },
    })

    expect(await countPendingRecurrences()).toBe(0)
  })

  it('counts nothing when there is no earlier week', async () => {
    await makeObjective()

    expect(await countPendingRecurrences()).toBe(0)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`
Expected: FAIL — `countPendingRecurrences is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/actions/weeklyGoals.ts`:

```ts
export async function countPendingRecurrences(): Promise<number> {
  const { weekStart: currentWeekStart } = getWeekBounds(new Date())
  const missing = await findMissingGoals(currentWeekStart)

  return missing ? pendingRecurrences(missing.goals).length : 0
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/weeklyGoals.ts src/lib/actions/weeklyGoals.test.ts
git commit -m "feat: add countPendingRecurrences"
```

---

### Task 6: `materializePendingWeek`

**Files:**
- Modify: `src/lib/actions/weeklyGoals.ts` (extract the cloning helper, append the action)
- Test: `src/lib/actions/weeklyGoals.test.ts`

**Interfaces:**
- Consumes: `findMissingGoals`, `pendingRecurrences` (Tasks 4-5)
- Produces (module-private): `async function cloneGoalsInto(tx: Prisma.TransactionClient, goals: SourceGoal[], sourceWeekStart: Date, currentWeekStart: Date, currentWeekEnd: Date): Promise<void>`
- Produces: `export async function materializePendingWeek(): Promise<void>`

The cloning body is now needed by two actions, so it is extracted rather than duplicated. It copies `recurring` from the source goal, which is correct for both callers: `repeatMissingGoals` only ever passes one-off goals (copying `false`), and this action only ever passes recurring ones (copying `true`, which is what keeps the chain alive).

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe` block, adding `materializePendingWeek` to the import list:

```ts
  it('materialises a recurring goal with its tasks on the same weekdays', async () => {
    const objective = await makeObjective()
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const lastWeek = getWeekBounds(addWeeks(currentWeekStart, -1))
    const goal = await prisma.weeklyGoal.create({
      data: { title: 'Academia', objectiveId: objective.id, recurring: true, ...lastWeek },
    })
    await prisma.dailyTask.createMany({
      data: [
        { title: 'Treino A', weeklyGoalId: goal.id, date: addDays(lastWeek.weekStart, 0), completed: true },
        { title: 'Treino B', weeklyGoalId: goal.id, date: addDays(lastWeek.weekStart, 2) },
      ],
    })

    await materializePendingWeek()

    const [created] = await prisma.weeklyGoal.findMany({
      where: { weekStart: currentWeekStart },
      include: { dailyTasks: { orderBy: { date: 'asc' } } },
    })

    expect(created.title).toBe('Academia')
    expect(created.dailyTasks).toHaveLength(2)
    expect(differenceInCalendarDays(created.dailyTasks[0].date, currentWeekStart)).toBe(0)
    expect(differenceInCalendarDays(created.dailyTasks[1].date, currentWeekStart)).toBe(2)
    expect(created.dailyTasks[0].completed).toBe(false)
    expect(created.dailyTasks[0].completedAt).toBeNull()
  })

  it('carries the recurring flag onto the clone, so the chain continues', async () => {
    const objective = await makeObjective()
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const lastWeek = getWeekBounds(addWeeks(currentWeekStart, -1))
    await prisma.weeklyGoal.create({
      data: { title: 'Academia', objectiveId: objective.id, recurring: true, ...lastWeek },
    })

    await materializePendingWeek()

    const [created] = await prisma.weeklyGoal.findMany({ where: { weekStart: currentWeekStart } })
    expect(created.recurring).toBe(true)
  })

  it('leaves one-off goals behind', async () => {
    const objective = await makeObjective()
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const lastWeek = getWeekBounds(addWeeks(currentWeekStart, -1))
    await prisma.weeklyGoal.create({
      data: { title: 'Academia', objectiveId: objective.id, recurring: true, ...lastWeek },
    })
    await prisma.weeklyGoal.create({
      data: { title: 'Pontual', objectiveId: objective.id, ...lastWeek },
    })

    await materializePendingWeek()

    const current = await prisma.weeklyGoal.findMany({ where: { weekStart: currentWeekStart } })
    expect(current.map((g) => g.title)).toEqual(['Academia'])
  })

  it('leaves goals under a completed objective behind', async () => {
    const objective = await prisma.objective.create({
      data: { title: 'Terminado', startDate: new Date(), status: 'COMPLETED' },
    })
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const lastWeek = getWeekBounds(addWeeks(currentWeekStart, -1))
    await prisma.weeklyGoal.create({
      data: { title: 'Academia', objectiveId: objective.id, recurring: true, ...lastWeek },
    })

    await materializePendingWeek()

    expect(await prisma.weeklyGoal.findMany({ where: { weekStart: currentWeekStart } })).toHaveLength(0)
  })

  it('materialises once when called twice in a row', async () => {
    // React Strict Mode double-invokes effects in development, so this is the
    // normal case in dev, not an edge case.
    const objective = await makeObjective()
    const currentWeekStart = getWeekBounds(new Date()).weekStart
    const lastWeek = getWeekBounds(addWeeks(currentWeekStart, -1))
    const goal = await prisma.weeklyGoal.create({
      data: { title: 'Academia', objectiveId: objective.id, recurring: true, ...lastWeek },
    })
    await prisma.dailyTask.create({
      data: { title: 'Treino', weeklyGoalId: goal.id, date: lastWeek.weekStart },
    })

    await materializePendingWeek()
    await materializePendingWeek()

    const created = await prisma.weeklyGoal.findMany({
      where: { weekStart: currentWeekStart },
      include: { dailyTasks: true },
    })

    expect(created).toHaveLength(1)
    expect(created[0].dailyTasks).toHaveLength(1)
  })

  it('does nothing when there is no earlier week', async () => {
    await makeObjective()

    await materializePendingWeek()

    expect(await prisma.weeklyGoal.findMany()).toHaveLength(0)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`
Expected: FAIL — `materializePendingWeek is not a function`.

- [ ] **Step 3: Extract the cloning helper**

Add to `src/lib/actions/weeklyGoals.ts`, next to `findMissingGoals`:

```ts
/**
 * Clones goals from the source week into the current one, preserving each
 * task's weekday position.
 *
 * `recurring` is copied from the source, which is right for both callers:
 * `repeatMissingGoals` only ever passes one-off goals, and
 * `materializePendingWeek` only ever passes recurring ones — and a clone that
 * lost the flag would stop the chain after a single week.
 */
async function cloneGoalsInto(
  tx: Prisma.TransactionClient,
  goals: SourceGoal[],
  sourceWeekStart: Date,
  currentWeekStart: Date,
  currentWeekEnd: Date,
): Promise<void> {
  for (const goal of goals) {
    // `completed` and `completedAt` are left to their schema defaults
    // (false / null) — a week that has just arrived starts unfinished.
    const clone = await tx.weeklyGoal.create({
      data: {
        title: goal.title,
        objectiveId: goal.objectiveId,
        weekStart: currentWeekStart,
        weekEnd: currentWeekEnd,
        recurring: goal.recurring,
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
}
```

Then replace the cloning loop inside `repeatMissingGoals`'s transaction with a call to it:

```ts
    await cloneGoalsInto(tx, goals, missing.sourceWeekStart, currentWeekStart, currentWeekEnd)
```

- [ ] **Step 4: Write `materializePendingWeek`**

Append to `src/lib/actions/weeklyGoals.ts`:

```ts
export async function materializePendingWeek(): Promise<void> {
  const { weekStart: currentWeekStart, weekEnd: currentWeekEnd } = getWeekBounds(new Date())
  let touchedObjectiveIds: string[] = []

  await prisma.$transaction(async (tx) => {
    // Recomputed inside the transaction, not reused from whatever the page
    // rendered: React Strict Mode calls this twice on every dev page load, and
    // the second call must find nothing pending.
    const missing = await findMissingGoals(currentWeekStart, tx)
    if (!missing) return

    const goals = pendingRecurrences(missing.goals)
    if (goals.length === 0) return

    touchedObjectiveIds = [...new Set(goals.map((goal) => goal.objectiveId))]
    await cloneGoalsInto(tx, goals, missing.sourceWeekStart, currentWeekStart, currentWeekEnd)
  })

  revalidatePath('/')
  for (const objectiveId of touchedObjectiveIds) {
    revalidatePath(`/objectives/${objectiveId}`)
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/actions/weeklyGoals.test.ts`
Expected: PASS, all cases — including every case from the prerequisite plan, which the extraction must not have changed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/weeklyGoals.ts src/lib/actions/weeklyGoals.test.ts
git commit -m "feat: materialise recurring goals into the current week"
```

---

### Task 7: `WeekMaterializer` component

**Files:**
- Create: `src/components/week-materializer.tsx`
- Test: `src/components/week-materializer.test.tsx`

**Interfaces:**
- Consumes: `materializePendingWeek` is passed in as `onMaterialize` by Task 8
- Produces: `export function WeekMaterializer({ onMaterialize }: { onMaterialize: () => Promise<void> }): null`

Renders nothing. Its only job is to move the mutation out of the render pass, as the Next.js docs require. The server action's own `revalidatePath('/')` produces the new content, so there is no local state to manage.

- [ ] **Step 1: Write the failing tests**

Create `src/components/week-materializer.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { WeekMaterializer } from '@/components/week-materializer'

describe('WeekMaterializer', () => {
  it('calls onMaterialize once on mount', () => {
    const onMaterialize = vi.fn().mockResolvedValue(undefined)

    render(<WeekMaterializer onMaterialize={onMaterialize} />)

    expect(onMaterialize).toHaveBeenCalledTimes(1)
  })

  it('does not call it again when the parent re-renders', () => {
    const onMaterialize = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<WeekMaterializer onMaterialize={onMaterialize} />)

    rerender(<WeekMaterializer onMaterialize={onMaterialize} />)

    expect(onMaterialize).toHaveBeenCalledTimes(1)
  })

  it('renders nothing', () => {
    const { container } = render(<WeekMaterializer onMaterialize={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/week-materializer.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/week-materializer"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/week-materializer.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'

/**
 * Triggers materialisation of the current week from an effect rather than from
 * a render.
 *
 * Next's own guidance is explicit that mutations must never be a render
 * side-effect (`docs/01-app/02-guides/data-security.md`), and that they belong
 * in an effect or an action triggered from a Client Component
 * (`docs/01-app/02-guides/prefetching.md`). That is not academic here: the
 * sidebar renders `<Link href="/">`, which Next prefetches — a write in
 * `page.tsx` would create the week when the pointer crossed "Hoje".
 *
 * The ref guards against re-renders. React Strict Mode still double-invokes
 * this in development, which is why the server action recomputes what is
 * pending inside its own transaction.
 */
export function WeekMaterializer({ onMaterialize }: { onMaterialize: () => Promise<void> }) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    void onMaterialize()
  }, [onMaterialize])

  return null
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/week-materializer.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/week-materializer.tsx src/components/week-materializer.test.tsx
git commit -m "feat: add WeekMaterializer client trigger"
```

---

### Task 8: Trigger materialisation from the home page

**Files:**
- Modify: `src/app/page.tsx` (whole file)

**Interfaces:**
- Consumes: `countPendingRecurrences`, `materializePendingWeek` (Tasks 5-6); `WeekMaterializer` (Task 7)
- Produces: nothing new

No automated test — `src/app/` has no page-level tests. Verification is the full suite plus the manual walkthrough in Step 3.

- [ ] **Step 1: Rewrite `src/app/page.tsx`**

This starts from the four-state version built in the prerequisite plan and adds the materialiser to every branch that can have a pending recurrence — including S2, where a pending recurrence is precisely why the week looks empty.

```tsx
import { listDailyTasksByDate, toggleDailyTask } from '@/lib/actions/dailyTasks'
import { countObjectives } from '@/lib/actions/objectives'
import { getLifetimeStats } from '@/lib/actions/stats'
import {
  countPendingRecurrences,
  getMissingGoalsPreview,
  listWeeklyGoalsForCurrentWeek,
  materializePendingWeek,
  repeatMissingGoals,
} from '@/lib/actions/weeklyGoals'
import { FluidDayWeek } from '@/components/fluid-day-week'
import { HomeEmptyState } from '@/components/home-empty-state'
import { LifetimeProgressBanner } from '@/components/lifetime-progress-banner'
import { MissingGoalsCard } from '@/components/missing-goals-card'
import { ReturnEmptyState } from '@/components/return-empty-state'
import { WeekMaterializer } from '@/components/week-materializer'

// This page's correctness depends on the wall clock at request time (it
// filters tasks by "today" and computes "the current week" from `new
// Date()`), so it must never be statically prerendered — otherwise it freezes on the build day/week forever.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const goals = await listWeeklyGoalsForCurrentWeek()
  const stats = await getLifetimeStats()
  const preview = await getMissingGoalsPreview()
  // A read, never a write. The write happens in the effect below, because
  // Next prefetches the sidebar's link to "/" and a mutation here would run
  // on hover.
  const pendingRecurrences = await countPendingRecurrences()

  const banner = stats.totalCompleted > 0 ? <LifetimeProgressBanner {...stats} /> : null
  const materializer =
    pendingRecurrences > 0 ? <WeekMaterializer onMaterialize={materializePendingWeek} /> : null

  // S3 — the week is planned. The only branch that needs today's tasks.
  if (goals.length > 0) {
    const tasks = await listDailyTasksByDate(new Date())

    return (
      <main className="mx-auto max-w-2xl p-8 lg:max-w-6xl">
        {materializer}
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

  // S1 — nothing exists yet. Neither banner nor materialiser can apply.
  if ((await countObjectives()) === 0) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <HomeEmptyState variant="no-objective" />
      </main>
    )
  }

  // S2 when something can be brought forward, S2b when nothing can. A pending
  // recurrence is often exactly why this week is still empty, so the
  // materialiser belongs here too.
  return (
    <main className="mx-auto max-w-2xl p-8">
      {materializer}
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

- [ ] **Step 2: Run the full suite, the linter, and the build**

```bash
npm test
npm run lint
npm run build
```

Expected: all green, `/` still dynamic.

- [ ] **Step 3: Walk through it manually**

```bash
docker compose up -d
npm run dev
```

1. Create an objective and a weekly goal **in the previous week**, with the "Repetir toda semana" box checked and tasks on two different weekdays.
2. Load `/`. The current week should materialise on its own within a moment, with both tasks on the same weekdays and unchecked.
3. Reload `/`. Nothing new is created — the goal now has a counterpart.
4. Open the new week's goal in `/objectives/[id]` and confirm the "repete toda semana" marker is on it, which proves the flag was carried forward.
5. Add a **non**-recurring goal to the previous week and reload `/`. It must appear in the bring-forward card, not be materialised.
6. Complete the objective (`/objectives/[id]` → "Concluir objetivo", from the celebration plan — or set `status` to `COMPLETED` directly if that plan is not merged yet), delete the current week's goal, and reload. Nothing should materialise.
7. **The prefetch check.** With the browser devtools Network tab open on `/objectives`, hover the sidebar's "Hoje" link without clicking. The prefetch must not create the week — no goal should appear when you then navigate.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: materialise recurring goals when the home page loads"
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

- **Never move the materialisation into `page.tsx`'s render**, however much simpler it looks. Step 3.7 of Task 8 is the check that catches it: the sidebar's prefetched `<Link href="/">` would create the week on hover.
- **`countPendingRecurrences` must stay side-effect free.** It is called during render, which is only safe because it writes nothing.
- **Do not add back-filling of missed weeks.** Someone away three weeks gets this week only. Filling the three they missed with unchecked tasks would manufacture failure out of a lapse.
- **No end date, occurrence count, or per-task recurrence.** A recurrence stops when the flag is cleared or the objective is completed. Anything more is a series entity, which the spec rejected.
- **The `recurring: goal.recurring` line in `cloneGoalsInto` looks redundant and is not.** Without it, a materialised goal would be a one-off and the chain would end after a single week.
