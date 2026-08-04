# Objetivo como Tela de Gerência (Inline Weekly Goals + Recurring Tasks) Design

## Context

The `/objectives/[id]` detail page currently only lists weekly goals as read-only progress cards, with a "Nova meta semanal" button linking out to a separate page (`/objectives/[id]/weeks/new`), and daily tasks can only be created by navigating further into a specific weekly goal's own page (`/objectives/[id]/weeks/[weekId]`). This turned out to be effectively undiscoverable: a user trying to create "a task starting and finishing today" instead created an Objective (whose form has `startDate`/`targetDate` fields matching that description), which never surfaces in the "Hoje" view, because "Hoje" only lists `DailyTask` records — three levels below `Objective` in the hierarchy.

Separately, the `/objectives` list page links each objective's title to its detail page, but the link has no visual affordance (Tailwind's Preflight reset strips the default underline/color), so it reads as plain text and the destination page was never found.

This design addresses both: making the Objective detail page the primary place to create and browse weekly goals and daily tasks (inline, no extra page navigation for the common case), and making the entry point to that page visually obvious. It also adds recurring daily tasks (create the same task across multiple days of a week in one action), which came up while designing the inline task-creation UI.

## Goals

- `/objectives/[id]` becomes a self-contained management screen: weekly goals are created inline (no navigation to `/objectives/[id]/weeks/new`), and each weekly goal's card supports quick daily-task creation — including creating the same task across multiple days of that week at once — without navigating to the weekly goal's own page.
- Each weekly goal card shows a simple progress bar by default and can expand in place ("ver detalhes") to a small per-day bar chart plus a read-only list of that week's tasks.
- The weekly goal's own dedicated page (`/objectives/[id]/weeks/[weekId]`) remains the place to toggle/edit/delete individual tasks and to edit/delete the weekly goal itself — the inline card view is create + read only.
- The objective title on `/objectives` gets a clear link affordance (hover color + underline) so the detail page is discoverable.

## Non-goals

- No "recurrence group" concept in the data model. Marking multiple days creates independent `DailyTask` rows — editing or deleting one never affects the others. No new schema/migration.
- No inline editing, completion-toggling, or deletion of tasks from the objective page's expanded card view — that stays on the dedicated weekly goal page, per explicit decision during design.
- No change to `/objectives/[id]/weeks/[weekId]` or `/objectives/[id]/weeks/[weekId]/tasks/[taskId]/edit` — both are unchanged.
- No change to how `/` ("Hoje") or the current-week section query their data — tasks created inline are regular `DailyTask` rows, so they already flow into the existing queries with no changes needed there.
- Not making the whole `/objectives` card clickable — only the title, since the card also nests "Editar"/"Excluir" buttons and an outer link around them would be invalid/inaccessible nested-interactive markup.

## Data model / Server Actions

No Prisma schema changes. A recurring task is simply N `DailyTask` rows (one per selected day), each with its own independent `completed` state, all sharing the same `title` and `weeklyGoalId`.

New action in `src/lib/actions/dailyTasks.ts`:

```ts
export async function createDailyTasks(weeklyGoalId: string, formData: FormData): Promise<void> {
  const title = readTitle(formData)
  const dates = formData.getAll('dates').map((d) => parseISO(String(d)))
  if (dates.length === 0) throw new Error('Selecione ao menos um dia')

  await prisma.dailyTask.createMany({
    data: dates.map((date) => ({ title, date, weeklyGoalId })),
  })
  await revalidateWeekPath(weeklyGoalId) // extended below to also revalidate the objective page
  revalidatePath('/')
}
```

`revalidateWeekPath` (already fetches `objectiveId` via the weekly goal, to revalidate `/objectives/[id]/weeks/[weekId]`) gets one extra line to also `revalidatePath(`/objectives/${goal.objectiveId}`)`, since that page now shows live task data too. This is a shared helper already used by every daily-task action, so all of them (`createDailyTask`, `toggleDailyTask`, `deleteDailyTask`, `updateDailyTask`, and the new `createDailyTasks`) benefit from the fix.

The existing singular `createDailyTask` (single `date` field) is untouched — it keeps backing the form on the dedicated weekly goal page. `createWeeklyGoal` is also untouched and reused as-is for the inline "new weekly goal" card.

## Components

Three new client components, following the existing "server fetches, thin client wrapper owns UI state" pattern already used by `fluid-day-week.tsx`:

**`WeeklyGoalsPanel`** (`src/components/weekly-goals-panel.tsx`) — renders the list of `WeeklyGoalCard`s plus a trailing `AddWeeklyGoalCard`. Owns one piece of state: which goal id (if any) is currently expanded. Replaces the current inline `.map()` over `weeklyGoals` in `src/app/objectives/[id]/page.tsx`, which becomes a thin Server Component that fetches objective + weekly goals (now including each goal's `dailyTasks`, needed for the per-day chart) and passes them down.

**`WeeklyGoalCard`** (`src/components/weekly-goal-card.tsx`) —
- Header: goal title linking to `/objectives/[id]/weeks/[weekId]` (unchanged destination), simple `Progress` bar + `x/y tarefas (n%)` (reusing the existing `getWeekProgress` shape).
- Quick-add row, always visible: title `Input` + a 7-day strip (one toggle per day of *that goal's* week, computed from `goal.weekStart` via `addDays`) + "Criar" button, submitting to `createDailyTasks` (bound to the goal's id). Each day toggle is a real checkbox (`name="dates"`, `value={isoDateString}`) visually styled as a pill — labeled with the 3-letter weekday abbreviation and the actual day-of-month number (e.g. "TER 4"), so it's always consistent with the calendar regardless of which week the goal belongs to. The checkbox matching today's date starts pre-checked when today falls within `[weekStart, weekEnd]`, so the fastest path (type a title, hit enter) still defaults to "today" like the original request asked for; other days require an explicit tap.
- "Ver detalhes ▾" button expands the card (client-only, no refetch — `dailyTasks` were already fetched with the goal) to show: a small per-day bar chart (count of tasks per weekday, derived client-side from the already-loaded `dailyTasks`) and a read-only list of that week's tasks (title + completed/not, no controls).

**`AddWeeklyGoalCard`** (`src/components/add-weekly-goal-card.tsx`) — dashed "+" card matching the visual language of the other cards. Clicking it swaps its own content for the existing `WeeklyGoalForm` (unchanged, already a generic `action`-prop component), bound to `createWeeklyGoal` for this objective. A cancel action collapses it back to the dashed "+" state.

## Routing

`src/app/objectives/[id]/weeks/new/page.tsx` is deleted (folder and all), along with the "Nova meta semanal" link button in `src/app/objectives/[id]/page.tsx`'s header — creation now only happens via `AddWeeklyGoalCard`. `WeeklyGoalForm` and its existing test are untouched and get reused by the new card.

## `/objectives` link affordance

In `src/app/objectives/page.tsx`, the `<Link>` wrapping each objective's title gains `className="hover:text-primary hover:underline transition-colors"` (the dark theme's neon-green `--primary`, consistent with the rest of the app's interactive-element treatment). No other structural change to the card.

## Error handling

Consistent with the existing minimal-validation convention in `src/lib/actions/validation.ts` (reject bad input before it reaches Prisma, no dedicated error UI beyond the app's existing `error.tsx` boundary):
- Empty title → existing `readTitle` throw, unchanged behavior.
- Zero days selected in the quick-add strip → `createDailyTasks` throws `'Selecione ao menos um dia'` before touching the database.

## Testing

- `dailyTasks.test.ts`: new cases for `createDailyTasks` (real Postgres integration test, matching existing style) — creates one `DailyTask` per selected date, each independently completable; throws when no dates are provided.
- `weekly-goal-card.test.tsx` (new): day-strip labels/dates match the goal's actual `weekStart` (including a case where the goal's week does *not* contain "today", asserting no day is pre-checked); today's checkbox is pre-checked when applicable; "ver detalhes" toggles the per-day chart and task list.
- `add-weekly-goal-card.test.tsx` (new): clicking "+" reveals `WeeklyGoalForm`; cancel collapses back.
- `objectives.test.tsx` or equivalent existing coverage for the list page: extend to assert the title link carries the hover-affordance class.

## Files touched

- `src/lib/actions/dailyTasks.ts` — new `createDailyTasks`, `revalidateWeekPath` also revalidates `/objectives/[id]`
- `src/lib/actions/weeklyGoals.ts` — `listWeeklyGoalsByObjective` (or the page's call site) extended to include `dailyTasks`
- `src/app/objectives/[id]/page.tsx` — thin Server Component, renders `WeeklyGoalsPanel`, drops the "Nova meta semanal" link
- `src/components/weekly-goals-panel.tsx` — new
- `src/components/weekly-goal-card.tsx` — new
- `src/components/weekly-goal-card.test.tsx` — new
- `src/components/add-weekly-goal-card.tsx` — new
- `src/components/add-weekly-goal-card.test.tsx` — new
- `src/app/objectives/[id]/weeks/new/page.tsx` — deleted
- `src/app/objectives/page.tsx` — hover/underline class on the title link
