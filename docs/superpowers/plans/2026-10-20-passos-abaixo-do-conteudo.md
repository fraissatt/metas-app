# Small Steps Below the Today Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the side rails of #74 with a "Seus pequenos passos" section under the Today content: compound effect card, the year as dots in the page, and a "Ver o mês" button that opens the month in a centred dialog.

**Architecture:** Reuse the data layer of #74 (`getDayDots`, `day-dots.ts`, `Dot`, `CompoundEffectCard`) unchanged. Two client components own their own period state (`YearDotsCard` for the year, `MonthDotsDialog` for the month) and load other years through the same server action; a server `SmallStepsSection` composes them and `page.tsx` renders it inside each `<main>`.

**Tech Stack:** Next.js (read `node_modules/next/dist/docs/` before touching page code), React 19, Tailwind, the shadcn `Dialog` (`src/components/ui/dialog.tsx`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-20-passos-abaixo-do-conteudo-design.md` (rules and data from `2026-10-20-calendario-pontinhos-design.md`)

## Global Constraints

- All day/month/year math goes through `src/lib/dates.ts`; `dates-guard.test.ts` fails on `startOfDay`, `.getFullYear()`, `.getDay()`, `format(…'yyyy-MM-dd')` and the identifier `isToday` anywhere else. The dot flag is `isCurrentDay`.
- Copy (exact): section heading `Seus pequenos passos`; button `Ver o mês`; arrows `Ano anterior`, `Próximo ano`, `Mês anterior`, `Próximo mês`; year footer `{N} dias feitos em {ano}` (singular `1 dia feito em {ano}`); month footer `{X} de {Y} dias feitos`; first-dot hint `Seu primeiro ponto acende quando você concluir 60% das tarefas de um dia.`; grid labels `{ano}: {N dias feitos}` and `{mês de ano}: {X} de {Y} dias feitos`.
- Weekday initials `S T Q Q S S D`, Monday first. Tones, 60% threshold, compound effect: unchanged from #74.
- Month dialog opens on the current month, goes back to January of `firstYear`; next is disabled on the current month. The year card opens on the current year.
- Disabled arrows use `aria-disabled="true"` and ignore the click (never `disabled`), so keyboard focus stays; each period title is `aria-live="polite"`.
- A state that mirrors server data resets when the page sends a new `initial`.
- The page must never scroll sideways; the year grid scrolls inside its own card.
- Never run `next build` in the repo (it breaks the user's running `npm run dev`); never kill processes on the user's machine. Action tests need the test Postgres.
- Commits: detailed messages ending `Refs #81`, on `feature/81-passos-abaixo-do-conteudo`; no push without the user's go-ahead.

## Review Focus

1. Moving the month back across January (or forward across December) loads the neighbouring year; two quick clicks while a year is loading must not skip or repeat a month — test in Task 2.
2. Ticking a task refreshes the page: the year card and a reopened month dialog show the new data, not the first render — tests in Tasks 2 and 3.
3. A new user (no tasks): no year arrows, month arrows reach January only, hint shown, no crash on `firstYear === currentYear` — tests in Tasks 2, 3 and 4.
4. A 28-day February and a leap February render the right number of dots and leading blanks — test in Task 1.
5. At 400 px wide the page has no horizontal scroll: the year grid scrolls inside its card — manual check in Task 5.

---

### Task 1: `monthFromDots`

**Files:**
- Modify: `src/lib/day-dots.ts`
- Test: `src/lib/day-dots.test.ts`

**Interfaces:**
- Produces: `monthFromDots(dots: DayDot[], year: number, month: number): DayDot[]` (`month` is 1–12; returns that month's dots in order, `[]` if none).

- [ ] **Step 1: Write failing tests** in `day-dots.test.ts`: for `buildDayDots([], getYearDays(2026), now)`, `monthFromDots(dots, 2026, 2)` has length 28 and keys from `2026-02-01` to `2026-02-28`; for 2028 (`getYearDays(2028)`) month 2 has length 29; `monthFromDots(dots, 2026, 12)[30].key` is `2026-12-31`; `monthFromDots(dots, 2025, 6)` is `[]` for 2026 dots.
- [ ] **Step 2: Run** `npx vitest run src/lib/day-dots.test.ts` — expected FAIL (`monthFromDots` is not exported).
- [ ] **Step 3: Implement** in `src/lib/day-dots.ts` by filtering on the `yyyy-MM-` key prefix.
- [ ] **Step 4: Run** the same command plus `src/lib/dates-guard.test.ts` — expected PASS.
- [ ] **Step 5: Commit** `feat: pick one month out of a year of dots`.

### Task 2: `MonthDotsDialog`

**Files:**
- Create: `src/components/month-dots-dialog.tsx`
- Test: `src/components/month-dots-dialog.test.tsx`

**Interfaces:**
- Consumes: `DayDotsYear`, `monthFromDots`, `Dot`, `DotLegend`, `daysDoneLabel` (`dot.tsx`), `formatMonthYear`, `appWeekdayIndex`, `parseDay`, `components/ui/dialog`.
- Produces: `MonthDotsDialog({ initial, loadYear }: { initial: DayDotsYear; loadYear: (year: number) => Promise<DayDotsYear> })` (`'use client'`). `initial` is always the page's current-year data. It renders its own trigger button `Ver o mês`. The current month is the month of the dot with `isCurrentDay` in `initial`.

- [ ] **Step 1: Write failing tests** (fake `loadYear = vi.fn`, a `yearData(year, firstYear, doneKeys)` fixture built with `buildDayDots`, `now = 2026-10-20`):
  - clicking `Ver o mês` opens a dialog titled `outubro de 2026` with a `role="img"` named `outubro de 2026: 2 de 20 dias feitos` (two done days in October) and three leading blank cells, the legend, and the footer `2 de 20 dias feitos`;
  - `Mês anterior` shows `setembro de 2026` with footer `X de 30 dias feitos`, no `loadYear` call; `Próximo mês` returns to October and is then `aria-disabled`; clicking it again does nothing;
  - with `firstYear` 2025, going back from January 2026 calls `loadYear(2025)` and shows `dezembro de 2025`; `Mês anterior` is `aria-disabled` at `janeiro de 2025` (no data call);
  - two fast clicks on `Mês anterior` across January end on `novembro de 2025` (the second click waits for or queues after the loading year, never skipping);
  - with no day done the hint shows; with one it does not;
  - Escape closes and focus returns to `Ver o mês`; the title has `aria-live="polite"`;
  - `rerender` with a new `initial` (one more done day), then open: the new count shows.
- [ ] **Step 2: Run** `npx vitest run src/components/month-dots-dialog.test.tsx` — expected FAIL (module missing).
- [ ] **Step 3: Implement** the component. State `{ year, month, data }`, reset to `initial` and the current month on every open and close. The month's `Y` is the elapsed days for the current month (dots up to and including `isCurrentDay`) and the month length otherwise. Arrow clicks go through one async step function guarded by an in-flight ref so a second click waits for the first (use `useTransition` like `year-dots-dialog.tsx`).
- [ ] **Step 4: Run** the test file — expected PASS.
- [ ] **Step 5: Commit** `feat: add the month dialog`.

### Task 3: `YearDotsCard`

**Files:**
- Create: `src/components/year-dots-card.tsx`
- Test: `src/components/year-dots-card.test.tsx`

**Interfaces:**
- Consumes: Task 2's `MonthDotsDialog`; `layoutYearWeeks`, `Dot`, `DotLegend`, `daysDoneLabel`, `formatMonthShort`, `parseDay`.
- Produces: `YearDotsCard({ initial, loadYear }: { initial: DayDotsYear; loadYear: (year: number) => Promise<DayDotsYear> })` (`'use client'`), the year card with arrows, the grid, the footer and the `Ver o mês` dialog.

- [ ] **Step 1: Write failing tests** (same fixtures as Task 2):
  - the card shows the year as title, a `role="img"` named `2026: 2 dias feitos`, the footer `2 dias feitos em 2026` and the `Ver o mês` button;
  - `Ano anterior` calls `loadYear(2025)` and shows `2025` and `1 dia feito em 2025`; `Próximo ano` is `aria-disabled` on the current year; both arrows are absent when `firstYear === currentYear`; an `aria-disabled` arrow keeps focus after a click;
  - the title is a live region (`aria-live="polite"`);
  - `rerender` with a new `initial` (one more done day) updates the grid label and footer without a click — this test must fail before the reset effect exists;
  - the hint appears with no day done and not otherwise.
- [ ] **Step 2: Run** `npx vitest run src/components/year-dots-card.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement** `YearDotsCard`: move the grid markup (month labels row plus the 7-row grid of `Dot size="sm"`) from `src/components/year-dots-dialog.tsx`; grid columns at least 10 px wide and stretching to the card width, inside an `overflow-x-auto` wrapper. Reset the shown year when `initial` changes (derive-state-from-props pattern, no effect that fights the user's own navigation: reset only when the `initial` object identity changes).
- [ ] **Step 4: Run** the test file — expected PASS.
- [ ] **Step 5: Commit** `feat: add the year card with year navigation`.

### Task 4: `SmallStepsSection`, page wiring and clean-up

**Files:**
- Create: `src/components/small-steps-section.tsx`
- Modify: `src/app/page.tsx`
- Delete: `src/components/today-rails.tsx`, `src/components/today-rails.test.tsx`, `src/components/month-dots.tsx`, `src/components/month-dots.test.tsx`, `src/components/year-dots-dialog.tsx`, `src/components/year-dots-dialog.test.tsx`
- Test: `src/components/small-steps-section.test.tsx`, `src/app/page.test.tsx`

**Interfaces:**
- Consumes: `CompoundEffectCard`, `YearDotsCard`, `getDayDots`.
- Produces: `SmallStepsSection({ data }: { data: DayDotsYear })` (server component, passes `loadYear={getDayDots}`).

- [ ] **Step 1: Write failing tests**: `small-steps-section.test.tsx` (mock `@/lib/actions/stats` as in `today-rails.test.tsx`) — heading `Seus pequenos passos` (level 2), the compound card region `Efeito composto`, the year card; `page.test.tsx` — replace the two rails tests: with a planned week and with an empty week, `screen.getByRole('heading', { name: 'Seus pequenos passos' })` exists, `queryByRole('complementary')` is null, and for the planned week the section is inside `main`.
- [ ] **Step 2: Run** `npx vitest run src/components/small-steps-section.test.tsx src/app/page.test.tsx` — expected FAIL.
- [ ] **Step 3: Implement** `SmallStepsSection` (a `section` labelled by its heading, `mt-8`, children stacked with `gap`). In `page.tsx`, remove `TodayRails` and render `<SmallStepsSection data={dayDots} />` as the last child of each `<main>` (planned week and empty week), keeping the `getDayDots()` calls and their comments about the redirect order. Delete the six files above and fix any import of them.
- [ ] **Step 4: Run** `npx vitest run src/components src/app src/lib` and `npx tsc --noEmit`; expected PASS, no references to the deleted files.
- [ ] **Step 5: Commit** `feat: move the compound effect and calendar below the Today content`.

### Task 5: Full verification

- [ ] **Step 1:** `npm run lint` and `npx tsc --noEmit` — no errors.
- [ ] **Step 2:** `npm run test:tz` — all tests pass in UTC, America/Sao_Paulo and America/Rio_Branco.
- [ ] **Step 3:** With the user's `npm run dev` (start it with `preview_start` only if it is not running; no build), check `/` as a guest at 1280, 1600 and 1920 px and at 400 px (no page horizontal scroll), light and dark; open `Ver o mês`, go back past January, close with Escape; move the year arrows. Screenshot for the user.
- [ ] **Step 4:** Update `README.md` screenshots only if the user asks. Commit any fixes; ask the user before pushing and opening the PR to `develop` (`Closes #81`, repo template, attribution block, board #2).
