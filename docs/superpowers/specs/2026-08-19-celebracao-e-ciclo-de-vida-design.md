# Celebration and Objective Lifecycle Design

## Context

Nothing in the app ever finishes. `Status` has `COMPLETED` and `ABANDONED` (`prisma/schema.prisma:42`), no screen writes either, and `/objectives` renders the raw enum as the string `ACTIVE` (`src/app/objectives/page.tsx:30`). A weekly goal that reaches 100% looks exactly like one at 2/3 — `TodayTaskGroup` prints `3/3` and moves on (`src/components/today-task-group.tsx:37`), `WeekGoalProgressCard` closes its ring and says nothing (`src/components/week-goal-progress-card.tsx:57`). The single most rewarding moment the app can produce passes unmarked.

There is also nothing that accumulates **per objective**. The lifetime banner from `2026-08-19-progresso-acumulado-e-retomada-design.md` is global, summing every objective together. Open `/objectives/[id]` for a two-year gym objective and you get a bar chart of percent-per-week, where every bar resets. Nothing answers "how much of this have I built".

While designing that, one defect surfaced in the existing chart: `getObjectiveProgressSeries` (`src/lib/actions/progress.ts:7`) maps over **weekly goals**, not weeks, labelling each with `format(goal.weekStart, 'dd/MM')`. An objective with two goals in the same week produces two bars carrying an identical label. The per-week aggregation this design needs corrects that on the way past.

## Goals

### A weekly goal is fulfilled when every one of its tasks is done

Fulfilment is **derived, never stored**: `total > 0 && completed === total`. `WeeklyGoal.status` stays unwritten.

The `total > 0` half is not a formality. `completed === total` alone is `true` for a goal with no tasks at all, and a goal that was never planned celebrating itself is the worst possible false positive here. The existing percent calculation already special-cases the same condition (`week-goal-progress-card.tsx:17`).

A 4-of-5 week does not celebrate. That is deliberate: the lifetime banner already rewards every completed task continuously, which frees this signal to be the expensive, unambiguous one.

### Two different events, two different weights

The mockup that settled this treated both cards as changing together, which is true only when today's tasks happen to be the week's last. They are distinct facts and the design separates them:

- **`TodayTaskGroup`** marks *today's* share of a goal being done — its `completed/tasks.length` counts only today's tasks (`today-task-group.tsx:15`). This gets the lighter treatment: the count badge becomes a check.
- **`WeekGoalProgressCard`** marks the *week's* goal being fulfilled — it counts `goal.dailyTasks`, the whole week. This gets the full treatment: tinted surface, `✓ concluída` badge, the ring animating closed, and a reinforcement line.

Both compute from props already passed to them and both already re-render optimistically through `FluidDayWeek`'s shared `useOptimistic` state (`fluid-day-week.tsx:71`), so the celebration lands in the same frame as the click, before the server responds. The ring closes with the `stroke-dashoffset` transition that is already on it (`week-goal-progress-card.tsx:54`).

No confetti or particle burst. It was considered and deferred: it is additive over this treatment, and it wears out — by the tenth fulfilled goal it is noise between the user and the next task.

### Objectives are completed by hand, and stay as proof

- **Manual only.** An objective has no data-derived ending; weekly goals can keep being created forever. Completion by inference — "no goals for N weeks" — is explicitly rejected: an abandoned objective and a fulfilled one produce identical data, and guessing wrong either steals a real achievement or fabricates a false one. `ABANDONED` exists in the enum precisely because they are different outcomes.
- **Reversible, so no confirmation dialog.** `reopenObjective` undoes it. The project's `DeleteButton` confirms because deletion cascades and cannot be undone (`objectives/page.tsx:41`); this is neither, and interrupting a celebratory action with "are you sure?" sours the moment.
- **Preserved in a `Concluídos` section** at the foot of `/objectives`, below the active ones: title, completion date, total completed tasks, and — when `targetDate` was set — how it landed against the plan ("3 semanas antes do previsto"). `startDate` and `targetDate` are both collected today and rendered nowhere.

### Per-objective accumulation

Shown at the top of `/objectives/[id]` and compactly on each row of `/objectives`:

- **Weeks fulfilled** — the constancy signal. For a habit objective this is the number that matters at two years.
- **Completed tasks** — the volume signal.
- **Weeks since `startDate`** — the denominator that makes the first number legible. Measured with `differenceInCalendarWeeks(now, startDate, { weekStartsOn: 1 })`, so it counts week boundaries crossed rather than 7-day blocks, and agrees with `getWeekBounds`.
- **A strip of the objective's most recent weeks**, capped at 26. Like the lifetime banner's dot row, the strip spans only weeks the objective actually has, so a four-week-old objective shows four segments rather than 26 with 22 blank — which would read as failure to someone who has done nothing wrong.

**A week counts as fulfilled when every goal the objective had that week is fulfilled, and there was at least one.** If one goal closed and another sat at 2/3, the week was not fulfilled. "Any goal at 100%" would be too loose for a number meant to be trusted years later. A week containing a goal with zero tasks is therefore not fulfilled either, which follows from the `total > 0` rule rather than being a separate case.

"Fulfilled" means the same thing here as in the weekly celebration — one concept, two places.

## Non-goals

- **No inferred completion.** Covered above.
- **No `ABANDONED` UI.** The enum keeps the value; giving it a screen is separate work.
- **No `WeeklyGoal.status` writes.** It stays unused. Removing it would need a migration for no gain.
- **No celebration for partial weeks.** No "good enough, call it done" affordance.
- **No confetti.** Deferred, not rejected — additive over this design if the moment turns out to under-land in practice.
- **No changes to the home page.** `page.tsx` and its state resolution belong to the accumulated-progress design.
- **No new route.** A dedicated `/conquistas` page was considered and rejected: another sidebar entry that starts empty and stays empty for months.

## Schema

One migration:

```prisma
model Objective {
  // …
  completedAt DateTime?
}
```

`Status.COMPLETED` records *that* an objective finished; nothing records *when*, and the date is half of what makes it an achievement. `status` and `completedAt` are always written together — `COMPLETED` with a timestamp, `ACTIVE` with `null`.

## Data flow

### `src/lib/objectives.ts` — pure

```ts
export type ObjectiveWeek = {
  weekStart: Date
  total: number
  completed: number
  fulfilled: boolean
}

export function buildObjectiveWeeks(
  goals: Array<WeeklyGoal & { dailyTasks: DailyTask[] }>,
): ObjectiveWeek[]
```

Groups goals by `weekStart` (keyed on `toISOString()`), sums `total` and `completed` across every goal in the week, and sets `fulfilled` when the week held at least one goal and **every** one of them satisfied `total > 0 && completed === total`. Returns oldest first.

This is the aggregation `getObjectiveProgressSeries` should have been doing. That action is rewritten on top of it: `{ weekLabel: format(week.weekStart, 'dd/MM'), percent }` derived per week, one entry per week, which removes the duplicate-label defect without changing `ObjectiveProgressChart` at all.

Pure and DB-free, matching `src/lib/tasks.ts` and `src/lib/dates.ts`.

### `src/lib/actions/objectives.ts` — additions

```ts
export type ObjectiveStats = {
  weeksFulfilled: number
  tasksCompleted: number
  weeksSinceStart: number
  recentWeeks: ObjectiveWeek[] // the objective's own weeks, at most the last 26, oldest first
}

export async function getObjectiveStats(objectiveId: string): Promise<ObjectiveStats>
export async function completeObjective(id: string): Promise<void>
export async function reopenObjective(id: string): Promise<void>
export async function listObjectivesWithStats(): Promise<{
  active: Array<Objective & { stats: ObjectiveStats }>
  completed: Array<Objective & { stats: ObjectiveStats }>
}>
```

`getObjectiveStats` reads the objective's weekly goals including `dailyTasks`, runs `buildObjectiveWeeks`, and counts from the result — one query per objective, no aggregate SQL.

`listObjectivesWithStats` calls it per objective through `Promise.all`, following the precedent already set by `getObjectiveProgressSeries` (`progress.ts:15`). This is N+1 by construction. It is the right trade for a single-user app with a handful of objectives, and it keeps the week-fulfilment rule in one place instead of duplicating it into SQL. If objective counts ever grow into the hundreds, this is the thing to revisit.

`completeObjective` sets `status: 'COMPLETED'` and `completedAt: new Date()`; `reopenObjective` sets `status: 'ACTIVE'` and `completedAt: null`. Both revalidate `/objectives` and `/objectives/[id]`.

`listObjectives` stays as it is — other callers depend on it.

## Components

- **`src/components/week-goal-progress-card.tsx`** — computes `fulfilled` and, when true, renders with `border-primary` + `bg-accent`, swaps the `N/M tarefas` label for a `✓ concluída` badge, and appends a reinforcement line. Ring and sparkline are unchanged; the ring simply reaches full offset.
- **`src/components/today-task-group.tsx`** — when every one of today's tasks for the goal is done (and there is at least one), the count badge becomes a check. Lighter than the weekly treatment, because it is a smaller fact.
- **`src/components/objective-stats.tsx`** — new, presentational. Props: `ObjectiveStats`. Renders the three numbers and the 26-week strip. Reused at the top of `/objectives/[id]` and, in a compact variant, on each `/objectives` row.
- **`src/components/objective-status-button.tsx`** — new, `'use client'`. Props: `{ status: Status; onComplete: () => Promise<void>; onReopen: () => Promise<void> }`. One button that reads "Concluir objetivo" or "Reabrir" depending on status, with a `useTransition` pending state (`task-toggle.tsx:15` pattern). Rendered on `/objectives/[id]`, next to the title.
- **`src/app/objectives/page.tsx`** — splits into active and completed sections, replaces the raw `{objective.status}` string with the compact stats, and renders the achievement line for completed ones.
- **`src/app/objectives/[id]/page.tsx`** — adds `ObjectiveStats` and `ObjectiveStatusButton` above the existing chart.

## Error handling

`completeObjective` and `reopenObjective` throw on DB failure and are caught by the existing `src/app/error.tsx` boundary. Both are idempotent — completing an already-completed objective rewrites the same status with a new timestamp, which is harmless and not worth a guard.

`getObjectiveStats` on an objective with no weekly goals returns all zeros and an empty strip; that is a normal state, not an error.

## Testing

**`src/lib/objectives.test.ts`** (new, pure):
- Empty input returns `[]`.
- Two goals in the same week collapse into one entry with summed totals.
- A week is fulfilled only when every goal in it is at 100%.
- A week holding a goal with zero tasks is not fulfilled.
- A goal with zero tasks alone in a week yields an entry with `total: 0` and `fulfilled: false`.
- Entries come back oldest first.

**`src/lib/actions/objectives.test.ts`** (extended, DB):
- `getObjectiveStats` counts fulfilled weeks and completed tasks across several weeks.
- `getObjectiveStats` returns zeros for an objective with no goals.
- `recentWeeks` returns every week the objective has when there are fewer than 26, and the most recent 26 when there are more.
- `completeObjective` sets `COMPLETED` and a non-null `completedAt`.
- `reopenObjective` restores `ACTIVE` and nulls `completedAt`.
- `listObjectivesWithStats` puts completed objectives in the second bucket and active ones in the first.

**`src/lib/actions/progress.test.ts`** (extended, DB):
- Two goals in one week produce **one** series entry, not two — the regression this design fixes.
- The percent is computed across both goals' tasks combined.

**`src/components/week-goal-progress-card.test.tsx`** (extended):
- A goal with every task complete renders the `✓ concluída` badge and the reinforcement line.
- A goal at 2/3 renders neither.
- A goal with zero tasks renders neither — the `total > 0` guard.

**`src/components/today-task-group.test.tsx`** (new):
- All of today's tasks done renders the check badge.
- A partially done group still renders the `N/M` count.

**`src/components/objective-stats.test.tsx`** (new):
- Renders weeks fulfilled, tasks completed, and weeks since start.
- Renders one strip segment per entry, fulfilled ones distinguishable by a `data-` attribute rather than by colour.

**`src/components/objective-status-button.test.tsx`** (new):
- An `ACTIVE` objective offers "Concluir objetivo" and calls `onComplete`.
- A `COMPLETED` objective offers "Reabrir" and calls `onReopen`.

## Files touched

**New:**
- `src/lib/objectives.ts`
- `src/lib/objectives.test.ts`
- `src/components/objective-stats.tsx`
- `src/components/objective-stats.test.tsx`
- `src/components/objective-status-button.tsx`
- `src/components/objective-status-button.test.tsx`
- `src/components/today-task-group.test.tsx`
- `prisma/migrations/<timestamp>_objective_completed_at/migration.sql`

**Modified:**
- `prisma/schema.prisma` — `Objective.completedAt`
- `src/lib/actions/objectives.ts` — `getObjectiveStats`, `completeObjective`, `reopenObjective`, `listObjectivesWithStats`
- `src/lib/actions/objectives.test.ts` — cases above
- `src/lib/actions/progress.ts` — `getObjectiveProgressSeries` rebuilt on `buildObjectiveWeeks`
- `src/lib/actions/progress.test.ts` — cases above
- `src/components/week-goal-progress-card.tsx` — fulfilled treatment
- `src/components/week-goal-progress-card.test.tsx` — cases above
- `src/components/today-task-group.tsx` — day-complete badge
- `src/app/objectives/page.tsx` — active/completed sections, compact stats
- `src/app/objectives/[id]/page.tsx` — stats header and status button

## Relationship to the other designs

- **`2026-08-19-progresso-acumulado-e-retomada-design.md`** — independent. That one owns the home page and global stats; this one owns `/objectives`. The only shared idea is that both read completion data rather than storing derived state.
- **`2026-08-19-recorrencia-de-metas-design.md`** — one point of contact: an objective marked `COMPLETED` must stop materialising recurring goals. That rule is enforced in the recurrence design's query and declared in both documents. Nothing here depends on recurrence existing.
