# Accumulated Progress and Week Resumption Design

## Context

Every progress indicator in the app today is `completed / total` scoped to the current week: the ring and sparkline in `WeekGoalProgressCard` (`src/components/week-goal-progress-card.tsx:17`), the badge in `TodayTaskGroup` (`src/components/today-task-group.tsx:15`), the bar in `WeeklyGoalCard` (`src/components/weekly-goal-card.tsx:41`). All three reset to zero every Monday, all three have a denominator the user chooses, and none of them accumulate. A user who finished 100% last week opens the app on Monday to 0%.

The data to do better is already being written and never read. `DailyTask.completedAt` is set on every toggle (`src/lib/actions/dailyTasks.ts:92`) and is not referenced anywhere else in `src/`. `Objective.startDate` / `targetDate` are collected by `ObjectiveForm` and never rendered. `Status.COMPLETED` / `ABANDONED` exist in the enum with no UI that sets them.

Separately, the home page has exactly one empty state — the string `"Nenhuma tarefa para hoje."` (`src/components/fluid-day-week.tsx:90`). A first-time visitor with no objectives and a returning user who completed 247 tasks and disappeared for five days see the identical screen, and neither is offered an action. `listWeeklyGoalsForCurrentWeek` filters on exact `weekStart`/`weekEnd` equality (`src/lib/actions/weeklyGoals.ts:59`), so a returning user's previous weeks vanish completely rather than offering anything to resume from.

This design covers two changes, brainstormed together because they share one data path and one screen:

1. **A lifetime progress banner** — a number that only grows, plus a forgiving constancy metric, at the top of the home page.
2. **Four distinct home states** — replacing the single dead-end empty state, including a one-click "repeat last week" that rebuilds the current week from the most recent week that had goals.

The visual decisions were made through the brainstorming companion: banner placement (full-width strip above both columns, chosen over a right-rail placement that would hide it inside the mobile accordion) and the return state's treatment (with a preview of what will be created, chosen over a bare button and over a "your last task was 5 days ago" framing).

## Goals

### Lifetime progress banner

- **Placement:** a full-width strip above the existing `lg:flex-row` two-column container, spanning both columns. It renders on every home state where `totalCompleted > 0`, including the return state — not only on the normal task view.
- **Content:** the lifetime count of completed tasks, the date of the first completion (`"desde 29 de julho"`), and a row of dots — one per week in the window — showing which weeks had at least one completion, with a `"6 das últimas 8 semanas"` label.
- **Constancy metric:** weeks with activity, not consecutive days. A week counts as active if at least one task was completed in it. The metric only breaks after a full week with no completions, and recovers on the next completion. Consecutive-day streaks were explicitly rejected: the visible reset to zero is the moment users abandon a habit app, and this app's purpose is bringing people back.
- **Adaptive window:** the window spans from the week of the first completion to the current week, capped at 8 weeks. A user two weeks in sees two dots (`"2 das últimas 2 semanas"`), never eight dots with six unlit — which would read as failure to someone who has done nothing wrong.
- **Scope:** global, across all objectives. The home page is already global.

### Home states

Four states, resolved server-side in `src/app/page.tsx`:

| State | Condition | Screen |
|---|---|---|
| **S1** | zero `Objective` rows | Onboarding: explains objective → weekly goal → daily task, CTA to `/objectives/new` |
| **S2** | zero `WeeklyGoal` for the current week, ≥1 `WeeklyGoal` in an earlier week | Preview of the source week's goals + task counts, primary CTA "Repetir a semana de DD/MM", secondary link to `/objectives` |
| **S2b** | zero `WeeklyGoal` for the current week, none in any earlier week, ≥1 `Objective` | CTA to `/objectives` to create a first weekly goal — no repeat button, since there is nothing to repeat |
| **S3** | ≥1 `WeeklyGoal` for the current week | The existing 60/40 `FluidDayWeek` layout, unchanged |

S1, S2, and S2b replace the two-column layout entirely — they are page-level, centered, single-column at every breakpoint. S3 keeps the current layout; when `tasks` is empty the left column shows an inline empty state with an "add a task" link instead of today's bare sentence.

### Repeat last week

- **Source week:** the greatest `weekStart` strictly earlier than the current week's `weekStart`, across all objectives — not the immediately preceding calendar week. A user who has been away three weeks would find the preceding week empty, and that user is exactly who this exists for.
- **What is cloned:** every `WeeklyGoal` in the source week (title, `objectiveId`) and every `DailyTask` under them (title). Clones are created with `completed: false` and `completedAt: null`.
- **Date mapping:** `addDays(currentWeekStart, differenceInCalendarDays(task.date, sourceWeekStart))`. Calendar-day difference, not elapsed milliseconds, so a DST boundary inside the source week cannot shift a task by a day. A task on Tuesday of the source week lands on Tuesday of the current week.
- **Collision:** impossible by construction — the button is only rendered in S2, which requires the current week to have zero goals. The action re-checks this inside its transaction to absorb a double-submit.
- **Atomicity:** the whole clone runs in one `prisma.$transaction`. A partial failure that left goals without their tasks would be worse than not running at all.

## Non-goals

- **No schema change.** No migration in either item. Every field read here already exists.
- **No per-objective statistics.** The banner is global; objective-level progress stays as it is on `/objectives/[id]`.
- **No review screen before cloning.** A per-goal checkbox list was considered and rejected — the preview in the return state carries the same information without adding a step, and unwanted goals can be deleted from `/objectives/[id]` in one click.
- **No partial repeat.** A user with one goal in the current week who wants three more from last week is not served. Judged an edge case; revisit if it comes up in practice.
- **No `Status` transitions.** Marking an objective or weekly goal `COMPLETED` is item 2 of the UX review, not this one.
- **No changes to `/objectives`, `/objectives/[id]`, or the weekly goal detail page.** `WeeklyGoalCard`, `WeeklyGoalsPanel`, and `WeeklyGoalDayChart` are untouched.
- **No celebration/animation on completing a goal.** That is item 2 as well.

## Data flow

### `src/lib/stats.ts` — pure

Follows the existing convention of pure, DB-free logic in `src/lib/` with plain unit tests (`src/lib/tasks.ts`, `src/lib/dates.ts`).

```ts
export type WeekWindowEntry = { weekStart: Date; active: boolean }

export function buildWeekWindow(
  completedAts: Date[],
  now: Date,
  maxWeeks?: number, // default 8
): WeekWindowEntry[]
```

- Returns `[]` for an empty `completedAts`.
- The window ends at `getWeekBounds(now).weekStart` and begins at the later of: the week of the earliest `completedAt`, and `maxWeeks - 1` weeks before the current week.
- Entries are ordered oldest → newest, so rendering left-to-right reads chronologically.
- A week is `active` when at least one `completedAt` falls within its `getWeekBounds` range.

`getWeekBounds` (`src/lib/dates.ts:3`, `weekStartsOn: 1`) stays the single authority on where a week begins. This is the reason the bucketing happens in JS rather than in SQL: `date_trunc('week', "completedAt")` would be more efficient, but it introduces Postgres's own week convention as a second source of truth that has to be kept in sync by hand. The codebase contains no raw SQL today, and the dataset is a single user's task history.

### `src/lib/actions/stats.ts` — DB

```ts
export type LifetimeStats = {
  totalCompleted: number
  firstCompletedAt: Date | null
  weekWindow: WeekWindowEntry[]
}

export async function getLifetimeStats(): Promise<LifetimeStats>
```

Three queries:
- `prisma.dailyTask.count({ where: { completed: true } })` for `totalCompleted`.
- `findFirst` on `{ completed: true, completedAt: { not: null } }` ordered by `completedAt` ascending, selecting `completedAt`, for `firstCompletedAt`.
- `findMany` on `{ completed: true, completedAt: { gte: windowStart } }` selecting only `completedAt`, where `windowStart` is 7 weeks before the current `weekStart`; the result is passed to `buildWeekWindow`.

**Null handling:** a row with `completed: true` and `completedAt: null` is only reachable by writing to the DB directly (`toggleDailyTask` always sets both together). Such a row counts toward `totalCompleted` but cannot be placed in a week, so it is excluded from the window. This is deliberate and not treated as an error.

### `src/lib/actions/weeklyGoals.ts` — additions

```ts
export type LastWeekPreview = {
  sourceWeekStart: Date
  goals: Array<{ id: string; title: string; taskCount: number }>
}

export async function getLastWeekPreview(): Promise<LastWeekPreview | null>
export async function repeatLastWeek(): Promise<void>
```

`getLastWeekPreview` finds the greatest `weekStart` below the current week's, then returns that week's goals with a `_count` of their `dailyTasks`, ordered by `title` ascending. The explicit ordering matters: without it Postgres returns rows in an unspecified order, so the preview list could reshuffle between renders of the same data. Returns `null` when no earlier week exists — which is what distinguishes S2 from S2b.

`repeatLastWeek` resolves the same source week, reads its goals including `dailyTasks`, and inside a `$transaction`:

1. Re-checks `weeklyGoal.count({ where: { weekStart: currentWeekStart } })` and returns early if non-zero (double-submit guard).
2. Creates each `WeeklyGoal` with the source's `title` and `objectiveId`, the current week's `weekStart`/`weekEnd`, and the default `ACTIVE` status.
3. Creates the cloned `DailyTask` rows via `createMany`, with the remapped dates.

Then revalidates `/` and `/objectives/[objectiveId]` for each distinct objective touched.

### `src/app/page.tsx` — state resolution

The page is already `export const dynamic = 'force-dynamic'` and already a Server Component doing the fetching, so state selection belongs here; the client components stay presentational.

```
stats  = await getLifetimeStats()
goals  = await listWeeklyGoalsForCurrentWeek()

if goals.length > 0                    → S3: banner + FluidDayWeek (tasks fetched as today)
else if (await countObjectives()) === 0 → S1: onboarding (no banner — totalCompleted is 0)
else if (preview = await getLastWeekPreview()) → S2: banner + ReturnEmptyState
else                                    → S2b: banner + FirstGoalEmptyState
```

`listDailyTasksByDate` is only called on the S3 branch — the other three have no tasks to show.

`countObjectives()` is a new one-line `prisma.objective.count()` in `src/lib/actions/objectives.ts`, rather than `(await listObjectives()).length`, so the empty-state check does not pull every objective row.

The banner renders whenever `stats.totalCompleted > 0`, which naturally hides it in S1 and in the common S2b case (an objective created but nothing ever completed).

## Components

- **`src/components/lifetime-progress-banner.tsx`** — new, presentational, no `'use client'`. Props: `LifetimeStats`. Renders the count, the `"desde <data>"` line via `date-fns` `format`, the dot row, and the `"N das últimas M semanas"` label. Styled with existing tokens (`bg-accent`, `border-primary`, `text-primary`, `text-muted-foreground`) — no new colors, matching every other component in `src/components/`. Stacks vertically below `sm`, horizontal above.
- **`src/components/return-empty-state.tsx`** — new, `'use client'`. Props: `{ preview: LastWeekPreview; onRepeat: () => Promise<void> }`. Renders the preview list (goal title + `"N tarefas"`), a primary button wired to `onRepeat` through `useTransition` for the pending/disabled state (same pattern as `TaskToggle`, `src/components/task-toggle.tsx:15`), and a secondary `Link` to `/objectives`. The secondary CTA is a link rather than an inline form because creating a weekly goal requires choosing an objective, which lives on `/objectives/[id]`.
- **`src/components/home-empty-state.tsx`** — new, presentational. Props: `{ variant: 'no-objective' | 'no-goal' }`. Covers S1 and S2b, which differ only in copy and CTA target (`/objectives/new` vs `/objectives`).
- **`src/components/fluid-day-week.tsx`** — the `tasks.length === 0` branch (line 90) gains a link to `/objectives` alongside the message. The banner is *not* rendered here; it is a sibling in `page.tsx` so it can span both columns. Otherwise unchanged.

## Error handling

`repeatLastWeek` throws on DB failure and the transaction rolls back; the existing `src/app/error.tsx` boundary catches it. The double-submit guard makes a second concurrent call a no-op rather than a duplicate-creation bug. No new user-facing error copy — the button's pending state covers the normal case, and a genuine failure is a bug, not a flow.

`getLastWeekPreview` returning `null` is a normal state (S2b), not an error.

## Testing

Following the project's convention: pure logic gets plain unit tests, server actions get real-DB integration tests against `metas_app_test`, components get Testing Library tests with plain fixture objects.

**`src/lib/stats.test.ts`** (new, pure):
- Empty input returns `[]`.
- A single completion today returns a one-entry window, `active: true`.
- Completions spanning 3 weeks return 3 entries, oldest first, with the gap week `active: false`.
- History longer than `maxWeeks` is clamped to `maxWeeks` entries ending at the current week.
- A completion at 23:59 Sunday and one at 00:00 Monday land in different weeks (the `weekStartsOn: 1` boundary).

**`src/lib/actions/stats.test.ts`** (new, DB):
- `totalCompleted` counts only `completed: true` rows.
- `firstCompletedAt` is the earliest non-null `completedAt`.
- A `completed: true, completedAt: null` row counts toward the total and is absent from the window.
- Empty DB returns `{ totalCompleted: 0, firstCompletedAt: null, weekWindow: [] }`.

**`src/lib/actions/weeklyGoals.test.ts`** (extended, DB):
- `getLastWeekPreview` returns `null` when only the current week has goals.
- `getLastWeekPreview` picks the *most recent* earlier week when several exist, skipping empty weeks in between.
- `repeatLastWeek` clones goals and tasks with `completed: false` and `completedAt: null`.
- A source task on Tuesday lands on Tuesday of the current week.
- `repeatLastWeek` is a no-op when the current week already has a goal.
- Cloned goals keep their original `objectiveId`.

**`src/components/lifetime-progress-banner.test.tsx`** (new):
- Renders the count and the formatted first-completion date.
- Renders one dot per window entry, with active/inactive distinguishable (a `data-` attribute, not a color assertion).
- Renders `"N das últimas M semanas"` matching the window contents.

**`src/components/return-empty-state.test.tsx`** (new):
- Lists each preview goal with its task count.
- Clicking the primary button calls `onRepeat` once and disables while pending.
- Renders the secondary link to `/objectives`.

**`src/components/home-empty-state.test.tsx`** (new):
- The `no-objective` variant links to `/objectives/new`; the `no-goal` variant links to `/objectives`.
- Each variant renders its own copy, so the two are not silently interchangeable.

**`src/components/fluid-day-week.test.tsx`** (extended):
- The existing empty-tasks case additionally asserts the `/objectives` link is present.

## Files touched

**New:**
- `src/lib/stats.ts`
- `src/lib/stats.test.ts`
- `src/lib/actions/stats.ts`
- `src/lib/actions/stats.test.ts`
- `src/components/lifetime-progress-banner.tsx`
- `src/components/lifetime-progress-banner.test.tsx`
- `src/components/home-empty-state.tsx`
- `src/components/home-empty-state.test.tsx`
- `src/components/return-empty-state.tsx`
- `src/components/return-empty-state.test.tsx`

**Modified:**
- `src/app/page.tsx` — four-way state resolution, banner rendering
- `src/lib/actions/weeklyGoals.ts` — `getLastWeekPreview`, `repeatLastWeek`
- `src/lib/actions/weeklyGoals.test.ts` — cases above
- `src/lib/actions/objectives.ts` — `countObjectives`
- `src/components/fluid-day-week.tsx` — empty-tasks branch gains a link
- `src/components/fluid-day-week.test.tsx` — updated empty case

## Delivery

One spec, two implementation plans, executed in order:

- **Plan 1 — lifetime progress banner.** `src/lib/stats.ts`, `src/lib/actions/stats.ts`, `LifetimeProgressBanner`, and its rendering in `page.tsx` above the existing layout. Ships on its own with no state-model changes.
- **Plan 2 — home states and week resumption.** `countObjectives`, `getLastWeekPreview`, `repeatLastWeek`, the four-way branch in `page.tsx`, and the empty-state components. Consumes `getLifetimeStats` from plan 1.

Plan 1 is independently shippable; plan 2 depends on it only for the banner already being wired into `page.tsx`.
