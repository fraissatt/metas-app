# Pace chart on each objective Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native execution, chosen by the user) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A card on `/objectives/[id]` with a continuous line chart: real accumulated progress, an ideal line ending at 93 %, and a dotted projection at the current pace.

**Architecture:** A pure module `src/lib/pace.ts` builds the daily series and the summary from the objective's tasks; a server action feeds it; a client component draws it with recharts and owns the period selector. No schema change.

**Tech Stack:** Next.js (read `node_modules/next/dist/docs/` before touching routing or server code, per AGENTS.md), Prisma, recharts, date-fns through `src/lib/dates.ts`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-05-grafico-de-ritmo-design.md` (issue #133, branch `feature/133-grafico-ritmo`).

## Global Constraints

- Ideal ceiling: **93 %**, one exported constant `IDEAL_GOAL = 0.93`.
- Projection pace window: the last **14** days up to today (fewer for a younger objective); projection capped at **100 %**.
- The real line never decreases; no red, no minus sign, no "falling" wording anywhere. Behind = "Faltam N pontos para o ritmo ideal."
- Day math only through `src/lib/dates.ts` (`dates-guard.test.ts` enforces it). Tests must pass under `npm run test:tz` (UTC and America/Sao_Paulo).
- Period options: 30 dias, 60 dias, "Prazo todo"; an option longer than the objective's span is not offered; the range never passes the objective's end.
- Colors from existing tokens (`--primary` real, `--muted-foreground` ideal), both themes, no glow. UI copy in Portuguese; code and comments in English.
- Commits end with the `Co-Authored-By` line; commit messages say `Refs #133`. No push without the user's authorization.

## Review Focus

- Objective with no tasks: empty-state text, no crash, no division by zero.
- Objective with no `targetDate`: the range ends at the last planned task.
- Completed objective: no projection; real line stops at `completedAt`.
- Tasks completed before their scheduled day or after the range end: counted on the day of `completedAt`, never dropped or negative.
- A task with `completed = true` and `completedAt = null`: falls back to its scheduled `date`.
- Today before the objective's start or after its end: today is clamped into the range.
- Brasília vs UTC day boundary: a task completed at 23:30 in Brasília lands on that Brasília day under both test zones.

---

### Task 1: Pace series (pure)

**Files:**
- Create: `src/lib/pace.ts`
- Test: `src/lib/pace.test.ts`

**Interfaces:**
- Produces:
  - `export const IDEAL_GOAL = 0.93`
  - `export type PaceTask = { date: Date; completed: boolean; completedAt: Date | null }`
  - `export type PacePoint = { day: Date; ideal: number; real: number | null; projection: number | null }` (percentages 0–100)
  - `export type PaceSummary = { donePercent: number; idealPercent: number; projectedPercent: number | null; gapPoints: number; tasksPerWeekToCatchUp: number | null }`
  - `export function buildPaceSeries(input: { tasks: PaceTask[]; startDate: Date; targetDate: Date | null; completedAt: Date | null; today: Date }): { points: PacePoint[]; summary: PaceSummary } | null` — `null` when there are no tasks.

- [ ] **Step 1: Write the failing tests** in `pace.test.ts` (days built with `parseDay`, like `stats.test.ts`):
  - `returns null when the objective has no tasks`
  - `ideal ends at 93% on the last day of the range` (assert last point `ideal` ≈ 93)
  - `ideal follows the plan: a week with more tasks lifts it more than a lighter week` (2 tasks week 1, 6 tasks week 2; ideal gain of week 2 > week 1)
  - `real never decreases and stays flat across a day without completions`
  - `real counts a task on the day of completedAt, not its scheduled date`
  - `a completed task without completedAt falls back to its scheduled date`
  - `projection starts at today's real value, uses the last 14 days' pace and is capped at 100`
  - `no targetDate: the range ends at the last planned task`
  - `completed objective: projection is null on every point and real stops at completedAt`
  - `today after the end is clamped to the end; before the start to the start`
  - `summary.gapPoints is the positive distance below the ideal and 0 when ahead`
  - `a task completed at 23:30 Brasília counts on that day under both zones`

- [ ] **Step 2: Run** `npx vitest run src/lib/pace.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `buildPaceSeries` in `src/lib/pace.ts`. Approach: one point per Brasília day from `startDate` to the range end; ideal(d) = 93 × (tasks dated ≤ d ÷ total); real(d) = 100 × (tasks whose effective completion day ≤ d ÷ total) with effective completion day = `completedAt ?? date`; for days after `today` real is `null` and `projection` = min(100, real(today) + pace × days since today), pace = completions in the last 14 days ÷ days in that window as a percentage of total per day; `tasksPerWeekToCatchUp` = extra tasks per week needed for the projection to reach the ideal end (null when already on pace or no days left).

- [ ] **Step 4: Run** the same command. Expected: PASS; then `npm run test:tz -- src/lib/pace.test.ts` passes in both zones.

- [ ] **Step 5: Commit** `feat: pace series for the objective chart`.

### Task 2: Server action feeding the chart

**Files:**
- Modify: `src/lib/actions/progress.ts`
- Test: `src/lib/actions/progress.test.ts`

**Interfaces:**
- Consumes: `PaceTask` from Task 1.
- Produces: `export async function getObjectivePaceInput(objectiveId: string): Promise<{ tasks: Array<{ date: string; completed: boolean; completedAt: string | null }>; startDate: string; targetDate: string | null; completedAt: string | null }>` — dates as ISO strings so they cross the server/client boundary; owned objective only (`requireUser` + `findOwnedObjective`).

- [ ] **Step 1: Write failing tests** next to the existing ones: `returns every task of the objective across its weeks with dates as ISO strings`; `rejects an objective of another user` (same pattern as the existing ownership test in this file).
- [ ] **Step 2: Run** `npx vitest run src/lib/actions/progress.test.ts`. Expected: FAIL, export missing.
- [ ] **Step 3: Implement** with one `prisma.dailyTask.findMany({ where: { weeklyGoal: { objectiveId } } })` plus the objective row.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: action that feeds the pace chart`.

### Task 3: Pace chart card

**Files:**
- Create: `src/components/objective-pace-chart.tsx`
- Test: `src/components/objective-pace-chart.test.tsx`

**Interfaces:**
- Consumes: `buildPaceSeries`, `IDEAL_GOAL`, and the action's return type.
- Produces: `export function ObjectivePaceChart({ input }: { input: Awaited<ReturnType<typeof getObjectivePaceInput>> })` — client component.

- [ ] **Step 1: Write failing tests** (Testing Library; recharts is stubbed the way `weekly-goal-day-chart` tests do, check that file first):
  - `shows the empty state when there are no tasks` → "Sem tarefas planejadas ainda para gerar o gráfico."
  - `offers only the periods that fit the objective's span` (a 40-day objective shows "30 dias" and "Prazo todo", not "60 dias")
  - `switching the period keeps the selected button pressed (aria-pressed)`
  - `when behind, the summary says "Faltam N pontos para o ritmo ideal" and never shows a minus sign`
  - `when ahead or level, the summary says "Você está no ritmo ou à frente."`
  - `lists the three lines in the legend`
- [ ] **Step 2: Run** `npx vitest run src/components/objective-pace-chart.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the card: summary sentence, period toggle row (`aria-pressed`), recharts `LineChart` with three `Line`s (ideal dashed, real solid, projection dotted), tooltip with day, done % and ideal %, legend, `--border` grid like `objective-progress-chart.tsx`. The range shown is the last N days ending at the range end, clamped to the start.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: pace chart card`.

### Task 4: Wire into the objective page and verify

**Files:**
- Modify: `src/app/objectives/[id]/page.tsx` (render the card after the existing chart)

- [ ] **Step 1:** Fetch `getObjectivePaceInput(id)` beside the other loads and render `<ObjectivePaceChart input={...} />` in its own `mb-6` block.
- [ ] **Step 2: Run** `npm run lint`, `npx tsc --noEmit`, `npm run test:tz`. Expected: all green. Do not run `next build` over a running dev server (see project memory).
- [ ] **Step 3: Look at it** in the browser with seeded data: desktop and 390 px, light and dark, each period option, an objective with no tasks, one with no `targetDate`, a completed one. Fix what looks wrong.
- [ ] **Step 4: Commit** `feat: show the pace chart on the objective page`.

### Task 5: Independent review and handoff

- [ ] **Step 1:** One fresh reviewer on the whole branch against the spec and Review Focus; fix what it finds, each fix its own commit.
- [ ] **Step 2:** Stop and ask the user before any push or PR. When authorized: push the branch, PR to `develop` with the repo template, `Closes #133`, attribution block, assign and request review from `fraissatt`, add to board Project #2.
