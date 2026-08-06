# "Hoje" Tab — Group Tasks by Weekly Goal Design

## Context

The "Hoje" section of `FluidDayWeek` (`src/components/fluid-day-week.tsx`) currently renders one `Card` per task, each with a two-row layout: a header showing `objective title (linked) · goal title (plain text)`, then a content row with the checkbox and task title below it. With several tasks, this reads as a tall stack of near-identical cards and repeats the same objective/goal breadcrumb on every card even when consecutive tasks share the same weekly goal.

We explored alternative layouts through the brainstorming visual companion (three mockups: a flat linear list, tasks grouped by weekly goal, and a horizontal timeline/rail) and settled on the grouped option: tasks are clustered under their weekly goal, with the goal/objective context shown once per group instead of once per task.

## Goals

- Today's tasks are grouped by `weeklyGoal.id`. Groups appear in the order their goal first appears in the incoming `tasks` array — no new sorting is introduced.
- Each group has a header (green left accent bar) showing:
  - The weekly goal's title, linking to `/objectives/[objectiveId]/weeks/[goalId]`.
  - The objective's title below it, smaller/muted, linking to `/objectives/[objectiveId]`.
  - A completed/total badge (e.g. `1/2`) computed from that group's own tasks.
- Under each group header, one row per task: the existing `TaskToggle` checkbox + task title, no per-row objective/goal text (it's now on the group header). Completed tasks stay struck-through/muted, same as today.
- Row hover uses `bg-accent` (Tailwind utility mapped to the existing `--accent` token), matching the hover fix already applied to the chart components — no white flash.
- The "Esta semana" expandable section and the "Ver semana" toggle button are unchanged.

## Non-goals

- No change to how tasks/goals are fetched — `FluidDayWeek` keeps receiving the same `tasks`, `goals`, and `progress` props from its server-side caller.
- No new sort order for groups (e.g. by soonest deadline, alphabetical) — first-appearance order only.
- No change to the "Esta semana" section, `Progress` bars, or the expand/collapse behavior.
- No new reusable `Badge` UI primitive — the progress pill is a small inline element local to the new component, since nothing else in the app uses one yet.

## Components

**Grouping helper** — a pure function (colocated in `fluid-day-week.tsx`, no new file needed for a ~5-line helper) that takes the flat `tasks` array and returns groups keyed by `weeklyGoal.id`, preserving first-appearance order:

```ts
function groupTasksByWeeklyGoal(tasks: DailyTasks) {
  const order: string[] = []
  const byGoal = new Map<string, DailyTasks>()
  for (const task of tasks) {
    const goalId = task.weeklyGoal.id
    if (!byGoal.has(goalId)) {
      order.push(goalId)
      byGoal.set(goalId, [])
    }
    byGoal.get(goalId)!.push(task)
  }
  return order.map((goalId) => ({ weeklyGoal: byGoal.get(goalId)![0].weeklyGoal, tasks: byGoal.get(goalId)! }))
}
```

**`TodayTaskGroup`** (`src/components/today-task-group.tsx`, new) — presentational component rendering one group:
- Props: `weeklyGoal` (with nested `objective`), `tasks` (that group's tasks), `onToggleTask`.
- Header: `Link` to the weekly goal page (title), `Link` to the objective page (smaller, muted, below), and a pill badge showing `${completed}/${total}` derived from `tasks` in-component.
- Rows: `TaskToggle` + task title, `hover:bg-accent` per row, completed styling identical to the current `line-through text-muted-foreground` treatment.

`FluidDayWeek` calls `groupTasksByWeeklyGoal(tasks)` and maps the result to `TodayTaskGroup`s, replacing the current `tasks.map(...)` block. The empty-state check (`tasks.length === 0` → "Nenhuma tarefa para hoje.") is unchanged.

## Testing

Update `fluid-day-week.test.tsx`:
- Existing tests (empty state, week toggle expand/collapse, checkbox toggling, keyboard/AT hiding of the week panel) keep passing as-is since they query by task/goal title text, which still renders.
- New case: two tasks under the same weekly goal render one group header (goal + objective titles appear once) and two rows.
- New case: two tasks under two different weekly goals render two group headers, in the order the goals first appear in the `tasks` prop.
- New case: the group header's badge reflects completed/total for that group (e.g. `1/2` when one of two tasks in the group is completed).
- New case: the goal title link points to `/objectives/[objectiveId]/weeks/[goalId]` and the objective title link points to `/objectives/[objectiveId]`.

New `today-task-group.test.tsx` is not needed separately — covered through `FluidDayWeek`'s tests since the component has no standalone behavior worth isolating (it's a pure render of props already exercised above).

## Files touched

- `src/components/fluid-day-week.tsx` — replace the flat task-card list with `groupTasksByWeeklyGoal` + `TodayTaskGroup` mapping
- `src/components/today-task-group.tsx` — new
- `src/components/fluid-day-week.test.tsx` — new grouping/link/badge test cases
