# Weekly Goal Recurrence Design

## Context

Every task in this app is typed by hand, one week at a time. `createDailyTasks` (`src/lib/actions/dailyTasks.ts:34`) takes one title and a set of dates and writes one `DailyTask` per date — which solves the current week and nothing beyond it. A user who runs the same routine for two years retypes it 104 times.

That is the single largest cost of coming back after a lapse. The bring-forward offer designed in `2026-08-19-progresso-acumulado-e-retomada-design.md` reduces it to one click, but a click is still required every week, forever, for something the user already decided was permanent.

This design makes a weekly goal able to carry itself forward.

The two mechanisms coexist deliberately, with distinct jobs: **recurrence** for continuing commitments, **bring-forward** for weeks planned one at a time. A goal is only ever handled by one of them.

## Goals

### Recurrence is a flag, and the previous week is the template

One new column, `WeeklyGoal.recurring`. Materialising a week means cloning the recurring goals from the last planned week, with their tasks on the same weekday positions — the same operation `repeatMissingGoals` already performs, applied automatically and per goal.

The weekdays are not stored anywhere. They are already implied by the dates of the previous week's tasks, and duplicating them into a separate column would create a second source of truth that could disagree with the tasks it describes. Editing the recurrence means editing this week; the change propagates forward on its own from then on.

A dedicated recurrence model — a series entity with task templates — was considered and rejected. It is conceptually cleaner and materially more code: two new models, an editing surface for each, and a new question with no obvious answer ("does editing the series rewrite the week already materialised?").

**A clone is created with `recurring: true`**, or the chain stops after one week.

### Materialisation cannot run during render

`node_modules/next/dist/docs/01-app/02-guides/data-security.md:569`:

> Mutations (e.g. logging out users, updating databases, invalidating caches) should never be a side-effect, either in Server or Client Components.

And `02-guides/prefetching.md:218`:

> If your layouts or pages are not pure and have side-effects […] these might be triggered when the route is prefetched, not when the user visits the page. To avoid this, you should move side-effects to a `useEffect` hook or a Server Action triggered from a Client Component.

This is concrete, not theoretical: the sidebar renders `<Link href="/">` (`src/components/sidebar.tsx:9`), which Next prefetches. Materialising inside `page.tsx` would create the week when the pointer crossed "Hoje".

So: `page.tsx` counts what is pending — a pure read — and renders a small client component only when the count is non-zero. That component calls the server action on mount, the action revalidates, and the re-render drops the count to zero and unmounts it.

### Completed objectives stop generating

A goal is only materialised when its objective's `status` is not `COMPLETED`. This is the sole point of contact with `2026-08-19-celebracao-e-ciclo-de-vida-design.md`, and it does not depend on that design shipping — `Status.COMPLETED` already exists in the enum.

### Recurring goals are not offered manually

`getMissingGoalsPreview` gains a filter excluding `recurring` goals. Without it a recurring goal would appear in the bring-forward card during the moment between first render and materialisation, inviting the user to do by hand what is about to happen anyway. After this change the two mechanisms partition the missing set cleanly: recurring goals are materialised, the rest are offered.

## Non-goals

- **No scheduler.** There is no cron, no queue, and none is introduced. Materialisation happens when someone opens the app; a week nobody looks at is not generated, which is harmless because nobody is looking.
- **No back-fill.** Only the current week is materialised. Someone away for three weeks gets this week, not the three they missed — those weeks are over, and filling them with unchecked tasks would manufacture failure.
- **No per-task recurrence.** The flag is on the goal; every task under it comes along.
- **No end date or occurrence count.** A recurrence stops when the flag is cleared or the objective is completed.
- **No changes to the celebration or lifecycle design**, beyond reading `Objective.status`.

## Schema

One migration:

```prisma
model WeeklyGoal {
  // …
  recurring Boolean @default(false)
}
```

`@default(false)` means every existing row keeps today's behaviour and the migration needs no data step.

## Data flow

### `findMissingGoals` gains two fields

The helper built in the bring-forward plan (`src/lib/actions/weeklyGoals.ts`) already computes "goals in the source week with no counterpart this week". It is extended to carry what the two callers need to partition that set:

- `recurring` comes along automatically once the column exists (it selects whole rows).
- The objective's status is added via `include: { objective: { select: { status: true } } }`.

Its two existing callers then filter it in opposite directions:

- `getMissingGoalsPreview` keeps goals where `recurring === false`.
- `materializePendingWeek` keeps goals where `recurring === true` **and** `objective.status !== 'COMPLETED'`.

`repeatMissingGoals` continues to use the preview's half, so a recurring goal is never brought over by the button.

### New in `src/lib/actions/weeklyGoals.ts`

```ts
export async function countPendingRecurrences(): Promise<number>
export async function materializePendingWeek(): Promise<void>
```

`countPendingRecurrences` runs the shared helper and returns the size of the recurring, non-completed slice. It is a read with no side effects, safe to call during render and safe to prefetch.

`materializePendingWeek` opens a `prisma.$transaction`, re-runs the helper **inside** it, and clones the qualifying goals exactly as `repeatMissingGoals` does — same `addDays(currentWeekStart, differenceInCalendarDays(task.date, sourceWeekStart))` calendar-day mapping, same `completed: false` / `completedAt: null` defaults — with `recurring: true` on each clone. Recomputing inside the transaction is what makes a second concurrent call write nothing.

That guard is load-bearing here in a way it is not for the button: React's Strict Mode double-invokes effects in development, so the action is genuinely called twice on every dev page load. The second call finds nothing pending.

The cloning body is now needed by two actions. It is extracted into one module-private helper both call, rather than duplicated.

Then `/` and each touched `/objectives/[objectiveId]` are revalidated.

### `src/app/page.tsx`

`countPendingRecurrences()` joins the existing reads. When it returns a non-zero count, `<WeekMaterializer />` is rendered alongside whichever state applies — including S2, where the pending recurrence is precisely why the week looks empty.

## Components

- **`src/components/week-materializer.tsx`** — new, `'use client'`. Props: `{ onMaterialize: () => Promise<void> }`. Calls `onMaterialize` once from a `useEffect` on mount, guarded by a ref so a re-render cannot fire it again, and renders nothing. The server action's `revalidatePath('/')` produces the new content; there is no local state to manage.
- **`src/components/weekly-goal-form.tsx`** — gains a `recurring` checkbox ("Repetir toda semana"), defaulting from `defaultValues`. Its props widen from `{ title, weekOf }` to `{ title, weekOf, recurring }`. Used by both `AddWeeklyGoalCard` and the edit page, so create and edit are covered by the one change. The checkbox uses the project's `Checkbox` (`src/components/ui/checkbox.tsx`), as `WeeklyGoalCard`'s day pickers already do.
- **`src/components/weekly-goal-card.tsx`** — shows a small "repete toda semana" marker when the goal is recurring, so the flag is visible without opening the edit form.
- **`readWeeklyGoalFields`** (`src/lib/actions/weeklyGoals.ts:11`) — reads the new checkbox, so `createWeeklyGoal` and `updateWeeklyGoal` both persist it with no further change.

## Error handling

`materializePendingWeek` throws on DB failure and rolls back; `src/app/error.tsx` catches it. Because it is triggered from an effect rather than a user gesture, a failure surfaces as the week simply not appearing — the user can still plan it by hand, and the bring-forward card is there if the source week has non-recurring goals too. No new error copy.

A user who opens the app on Monday and Tuesday of the same week materialises once: after the first run the goals have counterparts and are no longer missing.

## Testing

**`src/lib/actions/weeklyGoals.test.ts`** (extended, DB):
- `countPendingRecurrences` counts only recurring goals with no counterpart this week.
- It excludes goals whose objective is `COMPLETED`.
- It returns 0 when the recurring goal already has a counterpart.
- `materializePendingWeek` clones recurring goals with their tasks on the same weekdays.
- Clones carry `recurring: true` — the assertion that keeps the chain alive past one week, checked directly on the created row rather than by simulating a second week.
- Non-recurring goals are left behind.
- Goals under a `COMPLETED` objective are left behind.
- Calling it twice in a row creates the goals once.
- `getMissingGoalsPreview` excludes recurring goals from its offer.
- `createWeeklyGoal` persists `recurring` from form data; omitting the checkbox yields `false`.
- `updateWeeklyGoal` can turn recurrence off again.

**`src/components/week-materializer.test.tsx`** (new):
- Calls `onMaterialize` exactly once on mount.
- Does not call it again when the parent re-renders.

**`src/components/weekly-goal-form.test.tsx`** (extended):
- Submits `recurring` when the box is checked.
- Renders it checked when `defaultValues.recurring` is true.

**`src/components/weekly-goal-card.test.tsx`** (extended):
- A recurring goal shows the marker; a one-off goal does not.

## Files touched

**New:**
- `src/components/week-materializer.tsx`
- `src/components/week-materializer.test.tsx`
- `prisma/migrations/<timestamp>_weekly_goal_recurring/migration.sql`

**Modified:**
- `prisma/schema.prisma` — `WeeklyGoal.recurring`
- `src/lib/actions/weeklyGoals.ts` — `findMissingGoals` extended, cloning extracted, `countPendingRecurrences`, `materializePendingWeek`, `readWeeklyGoalFields`
- `src/lib/actions/weeklyGoals.test.ts` — cases above
- `src/app/page.tsx` — pending count and `WeekMaterializer`
- `src/components/weekly-goal-form.tsx` — recurring checkbox
- `src/components/weekly-goal-form.test.tsx` — cases above
- `src/components/weekly-goal-card.tsx` — recurring marker
- `src/components/weekly-goal-card.test.tsx` — cases above
- `src/app/objectives/[id]/weeks/[weekId]/edit/page.tsx` — passes `recurring` into `defaultValues`

## Relationship to the other designs

- **`2026-08-19-progresso-acumulado-e-retomada-design.md`** — this design **must ship after** it. It extends `findMissingGoals`, `getMissingGoalsPreview`, and the cloning logic built there. Implementing this first would mean building those twice.
- **`2026-08-19-celebracao-e-ciclo-de-vida-design.md`** — reads `Objective.status` to skip completed objectives. Order-independent: the enum value exists today whether or not any UI writes it.
