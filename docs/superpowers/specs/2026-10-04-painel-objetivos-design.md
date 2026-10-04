# Objectives Dashboard Design

## Context

`/objectives` (`src/app/objectives/page.tsx`) lists each objective as a plain card: a title link, one line of stats from `ObjectiveStatsPanel` in compact mode, and Editar/Excluir buttons. The detail page has charts, but the list gives no sense of momentum, so the user finds it discouraging to visit. Brainstorming on 2026-10-02 and 2026-10-04 settled on **option C, a dashboard plus rich cards**, using the same visual design as the mockup the user approved:
- a dark card on `bg-card` with a neon glow on hover;
- an eight-bar weekly chart, with fulfilled weeks in a green gradient and the others in a neutral color;
- a big tabular percentage;
- a streak chip;
- a support-to-primary timeline bar;
- a small "+ Meta da semana" button.

All the data already exists. `listObjectivesWithStats()` returns each objective with `stats.recentWeeks`: up to 26 `ObjectiveWeek` entries (`weekStart`, `total`, `completed`, `fulfilled`), but only for weeks that had goals. The objective itself carries `startDate` and `targetDate`. No schema change is needed.

## Goals

### Pure derivations (`src/lib/objective-dashboard.ts`)

These are pure functions with unit tests and no I/O. `now` is always passed in.

- `calendarWeeks(weeks: ObjectiveWeek[], now: Date, count = 8): DashboardWeek[]`
  - **Returns** exactly `count` entries, one per calendar week (Monday start, via `getWeekBounds`), oldest first, ending with the week containing `now`.
  - **Shape:** each entry is `{ weekStart: Date; total: number; completed: number; fulfilled: boolean; percent: number; hasGoal: boolean; current: boolean }`.
  - **Weeks with no goals** get `total: 0`, `completed: 0`, `fulfilled: false`, `percent: 0` and `hasGoal: false`.
  - **`percent`** is `Math.round(completed / total * 100)` when `total > 0`, otherwise 0.
  - **Matching** to `weeks` compares the week start's calendar date, not the exact timestamp.
- `streak(weeks: ObjectiveWeek[], now: Date): number`
  - **Counts** consecutive fulfilled calendar weeks, walking backwards from the most recent *finished* week.
  - **The current week:** if it is fulfilled, it counts and the walk continues from the previous week. If it is not fulfilled yet, it is skipped without breaking the streak, because it is still in progress.
  - **A week with no goal** breaks the streak, and so does a goal that wasn't fulfilled.
  - **Limit:** the result can't exceed the number of weeks available, 26.
- `recentRate(weeks: DashboardWeek[]): number | null`
  - **Returns** the sum of `completed` divided by the sum of `total` across the given weeks, as a rounded percentage.
  - **Returns `null`** when the total is 0.
- `timeline(startDate: Date, targetDate: Date | null, now: Date)`
  - **Without a target date:** `{ kind: 'open', weeksActive: number }`, where `weeksActive` is calendar weeks since start, minimum 1.
  - **With a target date:** `{ kind: 'dated', elapsedPercent: number, targetDate: Date, overdue: boolean }`. `elapsedPercent` is clamped to 0–100, and `overdue` is `now > targetDate`.
- `overview(active: ObjectiveWithStats[], now: Date)` returns `{ activeCount, weeksFulfilled, recentRate }`:
  - **`weeksFulfilled`** is the sum of `stats.weeksFulfilled` over active objectives.
  - **`recentRate`** is the pooled `recentRate` of each active objective's 8 calendar weeks: pooled task counts, not an average of percentages. It is `null` when nothing was planned.

### Page layout (`src/app/objectives/page.tsx`)

The page uses `max-w-5xl` (the header is `max-w-6xl`) and renders, in order:
1. **Title row:** `h1` "Objetivos" and the "Novo objetivo" button, unchanged.
2. **`ObjectivesOverview`**, shown only when there is at least one objective (active or completed): three tiles in a `grid-cols-3` row (`gap-3`):
   - **"objetivos ativos":** `activeCount`.
   - **"semanas cumpridas":** `weeksFulfilled`.
   - **"conclusão média (8 sem.)":** `recentRate%`, or "—" when null.
   - **Styling:** the number is `text-2xl font-bold text-accent-foreground tabular-nums` and the label is `text-xs text-muted-foreground`. Tiles are `rounded-lg border bg-card p-3`.
   - **Mobile:** the three tiles stay in one row, with the numbers dropping to `text-xl`.
3. **Active objectives** as `ObjectiveDashboardCard` in a grid: `grid gap-4 md:grid-cols-2`.
4. **"Concluídos" section,** keeping the existing heading style, with completed objectives as `CompletedObjectiveCard` in the same grid.
5. **Empty states:**
   - **No objectives at all:** a centered block with "Você ainda não tem objetivos." and a primary button "Criar meu primeiro objetivo" linking to `/objectives/new`. No overview.
   - **No active objectives, but some completed:** the overview still shows, and the active area shows "Nenhum objetivo em andamento. Que tal começar o próximo?"

### `ObjectiveDashboardCard` (`src/components/objective-dashboard-card.tsx`)

This is a Server Component, except for the interactive pieces noted below. It takes `objective: ObjectiveWithStats` plus the precomputed `weeks: DashboardWeek[]`, `streak: number` and `timeline`. The page computes these with `now = new Date()` and passes them down, so the card stays pure. Delete is passed down as an action.

The container is `rounded-lg border border-border bg-card p-4 flex flex-col gap-3`, with `transition-[border-color,box-shadow]`. On hover or focus-within it gets `border-primary/40` and `shadow-[0_0_16px_var(--glow)]`, so it follows the theme's glow token, under `motion-safe`.

**Row 1:**
- **Title:** a `Link` to `/objectives/{id}`, `font-semibold`, with `line-clamp-2 break-words`.
- **Chip:**
  - When `streak > 0`: "🔥 {n} semana(s)" in `bg-accent text-accent-foreground`. The emoji is `aria-hidden`, and the accessible text is "{n} semanas seguidas cumpridas".
  - Else, when the current week has no goal: "sem meta nesta semana" in `bg-support-muted text-support-foreground`.
  - Otherwise, no chip.
- **`ObjectiveActionsMenu`** with a "⋯" trigger.

**Row 2:**
- **Left side:**
  - The big rate `recentRate(weeks)%` in `text-3xl font-bold text-accent-foreground tabular-nums`, or "—" when null.
  - The caption "média das últimas 8 semanas" in `text-xs text-muted-foreground`.
- **Right side: `WeeklyBars`** (client, for hover and focus tooltips).
  - **Bars:** 8 bars, `h-10`, flex with `gap-1`, about 55% of the row width.
  - **Height:** `max(percent, 4)%` for weeks with a goal. Weeks without one get a 2px stub in `bg-chart-1`.
  - **Color:** fulfilled weeks use `bg-linear-to-t from-chart-4 to-primary`, other weeks with a goal use `bg-chart-1`, and the current week gets a dashed top outline (`outline-dashed outline-1 outline-muted-foreground/50`).
  - **Tooltip:** each bar is a focusable `<span tabIndex={0} role="img">` with `aria-label` and a tooltip shown on hover and focus. The text is "{dd/MM} · {completed}/{total}" plus " ✓" when fulfilled, plus " (em andamento)" for the current week. Weeks without a goal read "{dd/MM} · sem meta". Use `formatDayMonth`.
  - **Group label:** the whole group has `role="group" aria-label="Últimas 8 semanas"`.
  - **Tooltip styling:** a small absolutely-positioned `bg-popover border text-popover-foreground text-[11px]` bubble above the bar, without a library. Only one is visible at a time, driven by the hovered or focused index in state.

**Row 3: timeline.**
- **`dated`:**
  - **Bar:** a 6px track (`bg-muted`) with a fill of `elapsedPercent%` in `bg-linear-to-r from-support to-primary`.
  - **Caption:** "início {dd/MM} · {elapsedPercent}% do prazo · meta {dd/MM}". When `overdue`, the caption ends with "prazo encerrado" in `text-destructive`, replacing "· meta …".
- **`open`:** no bar. The caption reads "início {dd/MM} · ativo há {n} semana(s) · sem data-meta".
- **Shared:** captions are `text-xs text-muted-foreground`.

**Row 4:** right-aligned "+ Meta da semana", a small secondary-style link button to `/objectives/{id}?nova-meta=1#nova-meta`.

### `ObjectiveActionsMenu` (`src/components/objective-actions-menu.tsx`, client)

- **Trigger:** Base UI Menu (`@base-ui/react/menu`) on an icon button with `aria-label="Ações do objetivo"`, using the Lucide `MoreHorizontal` icon.
- **Items:**
  - **"Editar"** navigates to `/objectives/{id}/edit` (rendered as a link).
  - **"Excluir…"** opens the existing delete confirmation.
- **Confirmation:** keeps the current copy, "Isso também excluirá todas as metas semanais e tarefas diárias relacionadas. Esta ação não pode ser desfeita.".
- **Refactor:** `src/components/delete-button.tsx` is refactored to export a controlled `DeleteConfirmDialog({ open, onOpenChange, action, label?, confirmDescription? })`. `DeleteButton` keeps its current API and behavior by composing a trigger with that dialog, so its existing tests keep passing. The menu uses `DeleteConfirmDialog`.
- **Positioning:** the menu popup uses the `popover` tokens, positioned under the trigger aligned to the end. Esc and outside clicks close it, which Base UI handles.

### `CompletedObjectiveCard` (`src/components/completed-objective-card.tsx`)

- **Container:** the same container without the hover glow.
- **Content:**
  - the title link;
  - "✓ Concluído em {formatDate}" plus the existing `describeSchedule` suffix, in `text-accent-foreground`;
  - "{weeksFulfilled} semanas cumpridas · {tasksCompleted} tarefas", muted;
  - the `ObjectiveActionsMenu`.
- **No chart.**

### "+ Meta da semana" deep link

- **Page:** `/objectives/[id]/page.tsx` reads `searchParams` (a Promise in Next 16; read the docs) and passes `openNewGoal = searchParams['nova-meta'] === '1'` to `WeeklyGoalsPanel`.
- **Panel:** `WeeklyGoalsPanel` forwards it to `AddWeeklyGoalCard` as `defaultOpen`. `AddWeeklyGoalCard` initialises `adding` from `defaultOpen`.
- **Anchor:** the card's wrapper gets `id="nova-meta"` and `scroll-mt-20`, so the hash scrolls it into view under the sticky header.
- **Focus:** when opened this way, the title input is focused via `autoFocus` on the form's title field, only when `defaultOpen` is set.

### Removed

`ObjectiveRow` and the old card markup in `objectives/page.tsx`. `ObjectiveStatsPanel` stays, because the detail page still uses it.

## Non-goals

- Charts with axes, legends or a chart library on the list page. The eight bars are plain elements.
- Reordering or pinning objectives, filters, and archiving.
- Changing the detail page beyond the deep link.
- New data or schema.

## Testing

- **`src/lib/objective-dashboard.test.ts`** covers:
  - `calendarWeeks`: 8 entries ending at the current week; empty weeks filled; `percent` and `current` flags; matching by calendar date.
  - `streak`, which has these cases:
    - fulfilled run;
    - current unfulfilled week skipped;
    - current fulfilled week counted;
    - gap breaks;
    - unfulfilled breaks;
    - empty → 0.
  - `recentRate`: pooled counts; `null` when nothing was planned.
  - `timeline`: open vs dated, clamping and overdue.
  - `overview`: sums and pooled rate.
- **`src/components/weekly-bars.test.tsx`:**
  - 8 bars with the right `aria-label`s;
  - the tooltip appears on hover and on focus and shows the right text;
  - the current week and no-goal weeks are labeled.
- **`src/components/objective-dashboard-card.test.tsx`** covers these cases:
  - streak chip vs "sem meta nesta semana" vs no chip;
  - rate and "—";
  - both timeline captions, including "prazo encerrado";
  - the "+ Meta da semana" href;
  - the title link.
- **`src/components/objective-actions-menu.test.tsx`:**
  - opening the menu shows Editar (correct href) and Excluir…;
  - Excluir… opens the confirmation;
  - confirming calls the action.
- **`src/components/delete-button.test.tsx`:** still passes unchanged.
- **`src/components/add-weekly-goal-card.test.tsx`:** `defaultOpen` renders the form immediately.
- **Page-level:** the existing `/objectives` behavior tests, if any, are updated for the new markup. Empty states are covered in a small page test, or via a pure `ObjectivesList` component if the page is hard to render in tests.
- **Manual browser check:**
  - both themes;
  - desktop two columns, 375px one column;
  - hover and focus tooltips;
  - the menu flows;
  - the deep link opening the form.
  - Per project memory, build verification is done in a separate checkout or with the user's dev server restarted, never by running `next build` over a running `npm run dev`.

## Files

New:
- `src/lib/objective-dashboard.ts`
- `src/components/objectives-overview.tsx`
- `src/components/objective-dashboard-card.tsx`
- `src/components/weekly-bars.tsx`
- `src/components/objective-actions-menu.tsx`
- `src/components/completed-objective-card.tsx`
- the tests listed above

Changed:
- `src/app/objectives/page.tsx`
- `src/app/objectives/[id]/page.tsx`
- `src/components/weekly-goals-panel.tsx`
- `src/components/add-weekly-goal-card.tsx`
- `src/components/weekly-goal-form.tsx` (optional `autoFocusTitle`)
- `src/components/delete-button.tsx`
