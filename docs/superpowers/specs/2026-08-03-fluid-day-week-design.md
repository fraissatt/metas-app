# Fluid Hoje/Semana View (Phase 2) Design

## Context

Phase 1 (`docs/superpowers/specs/2026-07-30-sidebar-visual-identity-design.md`) shipped the dark gray + neon green visual identity and the hover-collapsible sidebar. This phase addresses the second half of the original request: merging the separate "Hoje" (`/`) and "Semana" (`/week`) pages into one fluid view where the day-level detail (micro) can expand into the week-level overview (macro), in place, without navigating to another URL.

## Goals

- One route (`/`) shows today's daily tasks by default, with an explicit control to expand and reveal the current week's weekly goals (with progress bars) below it.
- The expand/collapse transition is smooth (CSS accordion), matching the interaction quality established by the sidebar's hover-expand in Phase 1.
- The sidebar's nav collapses from 3 items to 2 (`Hoje` + `Objetivos`), since `Semana` no longer has its own destination.
- `/week` stops existing as a page and redirects to `/` instead of 404ing.

## Non-goals

- No persistence of the expanded/collapsed state across page loads — it always starts collapsed.
- No day-by-day (Mon–Sun) breakdown of the week. "Macro" means the weekly-goals-with-progress view that `/week` already shows today, not a new per-day agenda.
- No changes to the underlying data actions (`listDailyTasksByDate`, `listWeeklyGoalsForCurrentWeek`, `getWeekProgress`) — this phase is purely presentational/structural.

## Architecture

`src/app/page.tsx` remains a Server Component and becomes the sole fluid view. It fetches both datasets in the same request:
- `listDailyTasksByDate(new Date())` — today's tasks (existing `/` behavior)
- `listWeeklyGoalsForCurrentWeek()` + `getWeekProgress(goal.id)` per goal — the current week's goals with progress (existing `/week` behavior)

Both datasets are ready in the initial HTML; expanding the week section never triggers a second fetch or a loading state — it's a pure client-side visibility toggle.

A new client component `src/components/fluid-day-week.tsx` receives both datasets as props and owns only the expand/collapse UI state (`useState<boolean>`, always initializes to `false`/collapsed, no `localStorage` or URL state). It renders:
1. The "Hoje" section (today's tasks, `TaskToggle` per task) — unchanged from the current `/` page's markup/behavior.
2. A toggle button ("Ver semana ⌄" / "Recolher semana ⌃") that flips the expand state.
3. The "Esta semana" section (weekly goals + `Progress` bars) — unchanged from the current `/week` page's markup/behavior, wrapped in a container that transitions via CSS Grid's `grid-template-rows: 0fr` → `1fr` trick (a `overflow-hidden` wrapper whose row track animates between `0fr` and `1fr`, so height animates smoothly without JS measuring `scrollHeight`).

`src/app/page.tsx` stays a Server Component; `fluid-day-week.tsx` is the only new Client Component (`'use client'`), keeping the same "server fetches, thin client wrapper for interactivity" pattern already used for `TaskToggle` and `DeleteButton`.

## Routing

`src/app/week/page.tsx` is deleted. In its place, the same file path becomes a minimal redirect: `redirect('/')` from `next/navigation`, so any existing bookmark or link to `/week` lands on the merged view instead of 404ing.

## Sidebar

`src/components/sidebar.tsx`'s `links` array drops the `{ href: '/week', label: 'Semana', icon: CalendarDays }` entry, leaving:
```
{ href: '/', label: 'Hoje', icon: Sun }
{ href: '/objectives', label: 'Objetivos', icon: Target }
```
`isLinkActive` and the rest of the component are unchanged — removing an array entry doesn't touch the matching logic.

## Interaction details

- Toggle button sits at the bottom of the "Hoje" section, full-width, styled as a dashed-border ghost button (per the approved mockup) so it doesn't compete visually with the neon-green primary actions elsewhere.
- Empty states keep today's existing copy in each section independently ("Nenhuma tarefa para hoje.", "Nenhuma meta semanal para esta semana.") — the toggle stays available even if one section is empty, since a user might still want to check.
- `TaskToggle` behavior (marking a task complete) is unchanged; it lives inside the "Hoje" section exactly as today.

## Testing

`fluid-day-week.tsx` gets a test file (`fluid-day-week.test.tsx`) following the `sidebar.test.tsx` pattern (Testing Library, queries by role/text, no mocking of the component's own behavior):
- Renders collapsed by default (week section not visible/expanded, button reads "Ver semana").
- Clicking the toggle button reveals the weekly goals and flips the button's label to "Recolher semana".
- Clicking again collapses it back.
- Today's tasks and their `TaskToggle` controls render and behave the same as the current `/` page's existing test coverage expects (no regression in that behavior).

## Files touched

- `src/app/page.tsx` — fetches both datasets, renders `FluidDayWeek`
- `src/components/fluid-day-week.tsx` — new
- `src/components/fluid-day-week.test.tsx` — new
- `src/app/week/page.tsx` — replaced with a `redirect('/')`
- `src/components/sidebar.tsx` — remove the `Semana` nav entry
