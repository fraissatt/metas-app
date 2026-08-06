# "Hoje" + "Semana" Split Layout Design

## Context

`FluidDayWeek` (`src/components/fluid-day-week.tsx`) currently renders "Hoje" and "Esta semana" sequentially: Hoje's grouped task list on top, then a "Ver semana"/"Recolher semana" toggle button that expands a collapsed `grid-rows` panel below it showing one `Card` per current-week goal (title, `Progress` bar, `completed/total (percent%)` text).

This sequential/accordion layout hides the week's progress by default and gives no visual line between a task checked off today and the goal it moves forward — the two are never on screen together unless the user explicitly expands the panel, and even then reading order is top-to-bottom rather than side-by-side.

We explored this through the brainstorming visual companion (three layout approaches, then three "week progress" visual treatments for the winning layout) and landed on: Hoje and Semana shown side-by-side on wide screens, Hoje wider than Semana, with each weekly goal in the Semana column rendered as a ring-progress + 7-day sparkline card instead of a linear progress bar. On narrow screens, the existing accordion stays, but with the same new card instead of the old plain one.

## Goals

- **Breakpoint:** below `lg` (1024px), behavior is unchanged — accordion with "Ver semana"/"Recolher semana". At `lg` and above, Hoje and "Progresso da semana" render side-by-side in a `lg:flex-row` container, both always visible (no toggle button, no collapse).
- **Proportions (`lg`+):** Hoje takes 60% of the row width, "Progresso da semana" takes 40% (`lg:basis-3/5` / `lg:basis-2/5`, or equivalent flex-basis).
- **Goal ordering in the Semana column:** goals that have at least one task in today's `tasks` prop come first, in the same order they appear via `groupTasksByWeeklyGoal(tasks)` — mirroring Hoje's order so the two columns read as paired rows at a glance. A subtle divider (small muted label, e.g. "outras metas da semana") separates them from the rest of the current week's goals, which follow in their existing order.
- **`WeekGoalProgressCard` (new component):** replaces the current `Card` + `Progress` block, used in both the `lg`+ side-by-side rail and the `<lg` accordion panel (same component, different surrounding container: `flex-row` wrapping vs. stacked). Per goal, it renders:
  - The existing colored left accent bar (same color mapping `TodayTaskGroup` already uses, so a goal reads as the same color in both columns).
  - Title (linking to `/objectives/[objectiveId]/weeks/[goalId]`) and objective title (linking to `/objectives/[objectiveId]`), same link targets as today.
  - A ring showing the week's completion percentage, rendered as an SVG `<circle>` with `stroke-dasharray`/`stroke-dashoffset` (not a CSS `conic-gradient`, which cannot transition its percentage smoothly without Houdini `@property`) so it animates when the percentage changes.
  - A 7-bar sparkline (Monday→Sunday, reusing `getWeekDays`), one bar per day, height proportional to that day's completed/total tasks. Each bar has a native `title` attribute (e.g. `"Ter: 2/2 tarefas"`) for a hover tooltip — no new tooltip dependency.
  - A `completed/total tarefas` label (e.g. `4/7 tarefas`) — same completed-tasks-over-total-tasks-for-the-week semantics `getWeekProgress` already uses today, just computed from the already-fetched `goal.dailyTasks` instead of a separate query. The ring's percentage is the same number. (Not day-based — a day can have several tasks, so "days completed" isn't a well-defined fraction here.)
- **Instant, animated feedback:** toggling a task in Hoje updates the corresponding goal's ring and sparkline bar immediately (optimistic), without waiting for the server round-trip — this is the core motivation for the redesign (seeing today's action and the week's result move together).

## Non-goals

- No change to how `page.tsx` fetches `tasks` (`listDailyTasksByDate`) — Hoje's data path is untouched.
- No click-through/scroll-linking between a Semana card and its Hoje group (e.g. clicking a ring card doesn't scroll to or highlight the Hoje group). Color-pairing and matching order are enough for now; can revisit later if it doesn't read as connected enough in practice.
- No new tooltip/popover library — the sparkline's per-day detail uses the native `title` attribute.
- No changes to `/objectives/[id]` or `/objectives/[id]/weeks/[weekId]` — `WeeklyGoalDayChart`, `WeeklyGoalCard`, and `weekly-goals-panel.tsx` are untouched. `WeekGoalProgressCard` is a separate, purpose-built component for the home page rail/accordion, not a generalization of `WeeklyGoalDayChart` (that one uses Recharts with axes/tooltip for a full-size detail view; this one is a compact glanceable card).

## Data flow

`listWeeklyGoalsForCurrentWeek()` (`src/lib/actions/weeklyGoals.ts:56`) already fetches each goal `include`ing `dailyTasks: true` — the full week's `DailyTask` rows per goal. Today, `page.tsx` (`src/app/page.tsx`) ignores that embedded array and instead computes `progress` via a separate `Promise.all(goals.map(g => getWeekProgress(g.id)))`, one extra query per goal.

`WeekGoalProgressCard` computes completed/total/percent **and** the per-day sparkline data directly from `goal.dailyTasks` (same `isSameDay`-per-`getWeekDays()`-day grouping `WeeklyGoalDayChart` already does), so:

- `page.tsx` drops the `getWeekProgress` loop and the `progress` prop entirely — `goals` (with `dailyTasks` already included) is passed straight through.
- `FluidDayWeek`'s prop signature changes from `{ tasks, goals, progress, onToggleTask }` to `{ tasks, goals, onToggleTask }`.
- `getWeekProgress` itself is untouched (still used elsewhere, e.g. the weekly goal detail page) — only `page.tsx`'s call site goes away.

## Optimistic update

The same `DailyTask` row for "today" exists in two places once passed down: `tasks` (via `listDailyTasksByDate`) and inside the matching goal's `goals[i].dailyTasks` (via `listWeeklyGoalsForCurrentWeek`). A checkbox toggle needs both to update in the same frame — the Hoje checkbox and the Semana ring/sparkline are different views over the same underlying fact.

`FluidDayWeek` wraps its `tasks`/`goals` props in `useOptimistic<{ tasks, goals }, taskId>`, with a reducer that finds the task by id in both structures and flips its `completed` flag. The toggle handler passed down to `TaskToggle` (via `TodayTaskGroup`) becomes:

```ts
function handleToggle(taskId: string) {
  setOptimisticState(taskId) // flips completed in both tasks[] and goals[].dailyTasks[]
  startTransition(async () => {
    await onToggleTask(taskId) // the real server action; revalidatePath('/') reconciles afterwards
  })
}
```

`TodayTaskGroup` and `groupTasksByWeeklyGoal` keep consuming `tasks` exactly as before (now the optimistic copy); `WeekGoalProgressCard` reads from the optimistic `goals`. No changes needed in `TaskToggle` itself — it already calls `action(taskId)` inside its own `startTransition` for pending-state styling, and `action` is now `handleToggle`.

## Testing

Update `fluid-day-week.test.tsx`:
- Drop the `progress` prop from every existing test call (signature change).
- New case: at `lg`+ width, both Hoje and "Progresso da semana" render without needing to click "Ver semana" (no toggle button present at that breakpoint — assert via container class/media query behavior is out of scope for jsdom; instead assert both sections are in the DOM simultaneously and unconditionally, since the accordion's `inert`/`aria-hidden` mechanics are being removed for the `lg`+ path).
- New case: a goal with a task today and a goal without one both render as `WeekGoalProgressCard`s, with the divider text ("outras metas da semana") appearing between the two groups only when both groups are non-empty.
- New case: toggling a task's checkbox immediately updates the matching `WeekGoalProgressCard`'s `completed/total tarefas` label, before `onToggleTask`'s promise resolves (assert synchronously after the click, before awaiting).
- Existing cases (grouping, links, empty state) keep passing with the `progress` prop removed from their render calls.

New `week-goal-progress-card.test.tsx`:
- Renders title/objective links pointing to the same targets `TodayTaskGroup` uses.
- Computes `completed/total tarefas` and `percent` from `dailyTasks` the same way `getWeekProgress` does (`completed = dailyTasks.filter(t => t.completed).length`, `total = dailyTasks.length`).
- Renders 7 sparkline bars, one per day of `getWeekDays(weekStart)`, each with a `title` attribute containing that day's completed/total count (grouped via `isSameDay`, matching `WeeklyGoalDayChart`'s existing per-day grouping).
- Ring reflects `percent` (assert the SVG circle's `stroke-dashoffset` or an equivalent data attribute, not a pixel-perfect visual check).

## Files touched

- `src/components/fluid-day-week.tsx` — `lg:flex-row` container replacing the accordion at `lg`+, `useOptimistic` for shared toggle state, goal ordering split (today's goals first + divider), drop `progress` prop
- `src/components/week-goal-progress-card.tsx` — new (ring + sparkline card, used in both the `lg`+ rail and the `<lg` accordion)
- `src/app/page.tsx` — drop the `getWeekProgress` loop and `progress` prop
- `src/components/fluid-day-week.test.tsx` — updated/new cases above
- `src/components/week-goal-progress-card.test.tsx` — new
