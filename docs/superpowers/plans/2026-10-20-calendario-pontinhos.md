# Dot Calendar and Compound Effect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop-only side rails on the Today screen: a compound-effect card (left) and a month dot calendar (right) with a "Ver o ano" dialog that browses years since the user started.

**Architecture:** Pure day/tone math in `src/lib/day-dots.ts` (new app-timezone helpers live in `src/lib/dates.ts`, the only file allowed to do date math). One read-only server action `getDayDots(year?)` in `src/lib/actions/stats.ts`. Two server components and one client dialog, composed by a `TodayRails` layout wrapper used by every signed-in branch of `src/app/page.tsx`.

**Tech Stack:** Next.js (read `node_modules/next/dist/docs/` before touching page code), React server components, Prisma/Postgres, Tailwind, the existing shadcn `Dialog`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-20-calendario-pontinhos-design.md`

## Global Constraints

- All day/week/month/year math goes in `src/lib/dates.ts`; `dates-guard.test.ts` fails on `startOfDay`, `.getFullYear()`, `.getDay()`, `format(…'yyyy-MM-dd')` etc. anywhere else.
- App day = `America/Sao_Paulo`. A task belongs to the day of its `date` field, never `completedAt`.
- Done threshold: `DONE_THRESHOLD = 0.6`; `ratio >= 0.6` done, `0 < ratio < 0.6` partial, else empty. Future days are always empty.
- Compound factor: `1.01 ** daysDone`, all-time days done. pt-BR: one decimal under 100 (`5,6×`), whole number with thousands separator from 100 (`1.427×`).
- Copy (exact): `1% melhor a cada dia feito`; `Seus {N} dias feitos já valem {X}` (singular `Seu 1 dia feito já vale 1,0×`); N = 0: `Cada dia feito soma 1%. Em um ano, isso vira 37×.`; month footer `{X} de {Y} dias feitos`; empty-month hint `Seu primeiro ponto acende quando você concluir 60% das tarefas de um dia.`; link `Ver o ano`; year footer `{N} dias feitos em {ano}`; legend `Nada feito`, `Parte feita`, `Dia feito`.
- Weeks start on Monday; weekday initials `S T Q Q S S D`.
- `firstYear` = the smaller of the user's `createdAt` year and the earliest task's `date` year.
- Rails only from the `2xl` breakpoint; below it the page renders exactly as today (rails `hidden 2xl:block`, content column width unchanged).
- Never run `next build` in the repo (it breaks the user's running `npm run dev`); never kill processes on the user's machine. Action tests need the test Postgres (`npm run test:migrate` once).
- Commits: detailed messages ending `Refs #74`, on `feature/74-calendario-pontinhos`; no push without the user's go-ahead.

## Review Focus

1. A task stored at 00:00 Brasília must land on that Brasília day when tests run with `TZ=UTC` (Vercel) — test in Task 2, and run `npm run test:tz` in Task 7.
2. Leap year: 2028 has 366 dots and Feb 29 — test in Task 1.
3. Another user's tasks never light a dot or count toward N — test in Task 3.
4. A `year` argument outside `firstYear..currentYear` (a hand-crafted call) is clamped, not an error or an empty future year — test in Task 3.
5. On screens below `2xl` nothing shifts: rails are present in the DOM but `hidden` — test in Task 6.

---

### Task 1: Year and month helpers in `dates.ts`

**Files:**
- Modify: `src/lib/dates.ts`
- Test: `src/lib/dates.test.ts`

**Interfaces:**
- Produces: `appYear(date: Date): number`; `getYearDays(year: number): Date[]` (00:00 Brasília of every day, Jan 1 → Dec 31); `getMonthDays(date: Date): Date[]` (every day of `date`'s app month); `appWeekdayIndex(date: Date): number` (0 = Monday … 6 = Sunday); `formatMonthYear(date: Date): string` (`outubro de 2026`, via `Intl`); `formatMonthShort(date: Date): string` (`out`).

- [ ] **Step 1: Write failing tests**

```ts
describe('year and month helpers', () => {
  it('reads the Brasília year, not the UTC one', () => {
    expect(appYear(new Date('2027-01-01T01:00:00Z'))).toBe(2026) // 22:00 on Dec 31 in Brasília
  })
  it('lists every day of a year', () => {
    expect(getYearDays(2026)).toHaveLength(365)
    const leap = getYearDays(2028)
    expect(leap).toHaveLength(366)
    expect(formatDayKey(leap[59])).toBe('2028-02-29')
    expect(formatDayKey(getYearDays(2026)[0])).toBe('2026-01-01')
  })
  it('lists the days of a month', () => {
    const days = getMonthDays(parseDay('2026-10-20'))
    expect(days).toHaveLength(31)
    expect(formatDayKey(days[0])).toBe('2026-10-01')
  })
  it('indexes weekdays from Monday', () => {
    expect(appWeekdayIndex(parseDay('2026-10-01'))).toBe(3) // Thursday
    expect(appWeekdayIndex(parseDay('2026-10-04'))).toBe(6) // Sunday
  })
  it('formats month names in pt-BR', () => {
    expect(formatMonthYear(parseDay('2026-10-20'))).toBe('outubro de 2026')
    expect(formatMonthShort(parseDay('2026-10-20'))).toBe('out')
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/lib/dates.test.ts` — expected FAIL (not exported).
- [ ] **Step 3: Implement** the six helpers in `src/lib/dates.ts` with the existing `inApp` options and `plain()` (date-fns `startOfYear`, `getYear`, `startOfMonth`, `getDaysInMonth`/`eachDayOfInterval` with `{ in: tz(...) }`). `formatMonthShort` strips the trailing dot Intl adds (`out.` → `out`).
- [ ] **Step 4: Run** `npx vitest run src/lib/dates.test.ts src/lib/dates-guard.test.ts` — expected PASS.
- [ ] **Step 5: Commit** `feat: add year and month helpers to the app date module`.

### Task 2: Pure dot math in `day-dots.ts`

**Files:**
- Create: `src/lib/day-dots.ts`
- Test: `src/lib/day-dots.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers, `formatDayKey`, `appToday`.
- Produces:
  - `export const DONE_THRESHOLD = 0.6`
  - `export type DayTone = 'empty' | 'partial' | 'done'`
  - `export type DayDot = { key: string; tone: DayTone; isToday: boolean }` (`key` is `yyyy-MM-dd`; plain data, safe to pass to client components)
  - `export type TaskDay = { date: Date; completed: boolean }`
  - `dayTone(completed: number, total: number): DayTone`
  - `buildDayDots(tasks: TaskDay[], days: Date[], now: Date): DayDot[]` — one dot per entry of `days`, in order; days after `appToday(now)` are `empty`.
  - `countDaysDone(tasks: TaskDay[]): number`
  - `compoundFactor(daysDone: number): number`
  - `formatFactor(factor: number): string`
  - `layoutYearWeeks(dots: DayDot[]): (DayDot | null)[][]` — columns of 7 (Mon→Sun); leading cells before Jan 1 are `null`, trailing cells after Dec 31 are `null`.

- [ ] **Step 1: Write failing tests**

```ts
it('picks the tone from the ratio', () => {
  expect(dayTone(0, 0)).toBe('empty')
  expect(dayTone(0, 3)).toBe('empty')
  expect(dayTone(1, 3)).toBe('partial')   // 33%
  expect(dayTone(5, 9)).toBe('partial')   // 55,5%
  expect(dayTone(3, 5)).toBe('done')      // exactly 60%
  expect(dayTone(4, 4)).toBe('done')
})
it('buckets tasks by their Brasília day and leaves the future empty', () => {
  const days = getMonthDays(parseDay('2026-10-01'))
  const tasks = [
    { date: parseDay('2026-10-05'), completed: true },
    { date: parseDay('2026-10-05'), completed: false },
    { date: parseDay('2026-10-06'), completed: true },
    { date: parseDay('2026-10-25'), completed: true },
  ]
  const dots = buildDayDots(tasks, days, new Date('2026-10-20T15:00:00Z'))
  expect(dots[4]).toEqual({ key: '2026-10-05', tone: 'partial', isToday: false })
  expect(dots[5].tone).toBe('done')
  expect(dots[19].isToday).toBe(true)
  expect(dots[24].tone).toBe('empty') // future
})
it('counts all-time days done', () => {
  expect(countDaysDone([
    { date: parseDay('2025-03-01'), completed: true },
    { date: parseDay('2026-10-05'), completed: true },
    { date: parseDay('2026-10-05'), completed: false },
    { date: parseDay('2026-10-05'), completed: false },
  ])).toBe(1)
})
it('compounds 1% per day and formats it', () => {
  expect(formatFactor(compoundFactor(0))).toBe('1,0×')
  expect(formatFactor(compoundFactor(70))).toBe('2,0×')
  expect(formatFactor(compoundFactor(365))).toBe('37,8×')
  expect(formatFactor(compoundFactor(730))).toBe('1.427×')
})
it('lays the year out in Monday-first weeks', () => {
  const dots = buildDayDots([], getYearDays(2026), new Date('2026-10-20T15:00:00Z'))
  const weeks = layoutYearWeeks(dots)
  expect(weeks.every((w) => w.length === 7)).toBe(true)
  expect(weeks[0].slice(0, 3)).toEqual([null, null, null]) // Jan 1 2026 is a Thursday
  expect(weeks[0][3]?.key).toBe('2026-01-01')
  expect(weeks.flat().filter(Boolean)).toHaveLength(365)
})
```

- [ ] **Step 2: Run** `npx vitest run src/lib/day-dots.test.ts` — expected FAIL.
- [ ] **Step 3: Implement** in `src/lib/day-dots.ts`: group tasks by `formatDayKey(date)` into `{ done, total }` maps; formatting with `Intl.NumberFormat('pt-BR')` (`maximumFractionDigits`/`minimumFractionDigits` 1 below 100, 0 from 100) plus `×`.
- [ ] **Step 4: Run** `npx vitest run src/lib/day-dots.test.ts src/lib/dates-guard.test.ts`, then the same with `TZ=UTC` (`npm run test:tz -- src/lib/day-dots.test.ts` if the script forwards args, else set `TZ` inline) — expected PASS in both.
- [ ] **Step 5: Commit** `feat: add the pure day-dot and compound-effect math`.

### Task 3: `getDayDots` server action

**Files:**
- Modify: `src/lib/actions/stats.ts`
- Test: `src/lib/actions/stats.test.ts`

**Interfaces:**
- Consumes: Task 1–2.
- Produces: `export type DayDotsYear = { year: number; dots: DayDot[]; daysDone: number; firstYear: number; currentYear: number }` (put the type in `src/lib/day-dots.ts` so client code can import it without the action file) and `getDayDots(year?: number): Promise<DayDotsYear>`.

- [ ] **Step 1: Write failing tests** (reuse `makeGoal` from the file; add a second user via `createTestUser('other')` with their own objective/goal):

```ts
describe('getDayDots', () => {
  it('returns the current year with every dot empty for a new user', async () => {
    const result = await getDayDots()
    expect(result.year).toBe(appYear(new Date()))
    expect(result.dots).toHaveLength(getYearDays(result.year).length)
    expect(result.dots.every((d) => d.tone === 'empty')).toBe(true)
    expect(result).toMatchObject({ daysDone: 0, firstYear: result.year, currentYear: result.year })
  })
  it('lights only the user’s own days and counts days done all-time', async () => { /* the user: a done day on 2026-10-05 and one on 2025-03-01; the other user: a done task on 2026-10-06 → only the 2026-10-05 dot is lit and daysDone === 2 */ })
  it('starts firstYear at the earliest task year', async () => { /* task dated 2025-03-01 → firstYear 2025 */ })
  it('clamps a year outside firstYear..currentYear', async () => {
    const now = appYear(new Date())
    expect((await getDayDots(1999)).year).toBe(now)   // firstYear is the current year for a fresh user
    expect((await getDayDots(now + 5)).year).toBe(now)
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/lib/actions/stats.test.ts` — expected FAIL.
- [ ] **Step 3: Implement** with `requireUser()` and the existing `owned` filter: one `findMany` for the year (`date` in `[getYearDays(y)[0], last day end]`, `select: { date, completed }`); one `findMany` of all tasks `select: { date, completed }` for `countDaysDone` and the earliest `date` (fine at this app's scale; note it in a comment); `prisma.user.findUnique({ select: { createdAt } })` for `firstYear`. Clamp `year` before querying.
- [ ] **Step 4: Run** `npx vitest run src/lib/actions/stats.test.ts` — expected PASS.
- [ ] **Step 5: Commit** `feat: read the user's day dots and days done for a year`.

### Task 4: `CompoundEffectCard`

**Files:**
- Create: `src/components/compound-effect-card.tsx`
- Test: `src/components/compound-effect-card.test.tsx`

**Interfaces:**
- Consumes: `compoundFactor`, `formatFactor`.
- Produces: `CompoundEffectCard({ daysDone }: { daysDone: number })` (server component, no `'use client'`).

- [ ] **Step 1: Write failing tests**: `daysDone={0}` shows `Cada dia feito soma 1%. Em um ano, isso vira 37×.`; `daysDone={70}` shows heading `1% melhor a cada dia feito` and `Seus 70 dias feitos já valem 2,0×`; `daysDone={1}` shows `Seu 1 dia feito já vale 1,0×`; the card is a `section` labelled `Efeito composto`.
- [ ] **Step 2: Run** `npx vitest run src/components/compound-effect-card.test.tsx` — FAIL.
- [ ] **Step 3: Implement** with the banner's visual language (`rounded-lg border border-primary bg-accent`, see `lifetime-progress-banner.tsx`) and a decorative `aria-hidden` SVG curve.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: add the compound effect card`.

### Task 5: `YearDotsDialog`

**Files:**
- Create: `src/components/year-dots-dialog.tsx`, `src/components/dot.tsx` (shared dot + legend)
- Test: `src/components/year-dots-dialog.test.tsx`

**Interfaces:**
- Consumes: `DayDotsYear`, `layoutYearWeeks`, `getDayDots`, `formatMonthShort`, `formatDate`, `parseDay`, `components/ui/dialog`.
- Produces: `Dot({ dot, size }: { dot: DayDot | null; size: 'sm' | 'md' })` (tone classes: empty `bg-muted`, partial `bg-primary/35`, done `bg-primary`; today `ring-2 ring-primary ring-offset-1`; `title` = `{dd/mm/aaaa} · {Nada feito|Parte feita|Dia feito}`; `aria-hidden`), `DotLegend()`, and `YearDotsDialog({ initial, loadYear }: { initial: DayDotsYear; loadYear: (year: number) => Promise<DayDotsYear> })` (`'use client'`; trigger button `Ver o ano`).

- [ ] **Step 1: Write failing tests** with a fake `loadYear` (`vi.fn`) and a fixture built via `buildDayDots`:
  - clicking `Ver o ano` opens a dialog titled `2026`, a `role="img"` grid labelled `2026: {N} dias feitos`, and the footer `{N} dias feitos em 2026`;
  - with `firstYear 2025`, the `Ano anterior` button calls `loadYear(2025)` and the title becomes `2025`; `Próximo ano` is disabled on the current year and `Ano anterior` disabled on `firstYear`;
  - with `firstYear === currentYear` neither arrow is rendered;
  - closing (Escape) returns focus to `Ver o ano`.
- [ ] **Step 2: Run** `npx vitest run src/components/year-dots-dialog.test.tsx` — FAIL.
- [ ] **Step 3: Implement**: state `{ data, loading }`; arrows call `loadYear` inside `useTransition`; grid is CSS grid `grid-flow-col grid-rows-7` of `layoutYearWeeks(data.dots)`, month labels over the column holding each month's day 1, horizontal scroll inside the dialog if narrow. Dialog width up to `max-w-4xl`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: add the year dot dialog with year navigation`.

### Task 6: `MonthDots`, `TodayRails` and the page

**Files:**
- Create: `src/components/month-dots.tsx`, `src/components/today-rails.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/components/month-dots.test.tsx`, `src/components/today-rails.test.tsx`, `src/app/page.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: `MonthDots({ data, now }: { data: DayDotsYear; now: Date })` (server; renders `YearDotsDialog` with `initial={data}` and `loadYear={getDayDots}`); `TodayRails({ data, children }: { data: DayDotsYear; children: React.ReactNode })`.

- [ ] **Step 1: Write failing tests**
  - `month-dots`: for 2026-10-20, heading `outubro de 2026`, a `role="img"` labelled `outubro de 2026: {X} de 20 dias feitos`, 3 leading blank cells, footer `{X} de 20 dias feitos`; with no done day the hint `Seu primeiro ponto acende quando você concluir 60% das tarefas de um dia.` shows; `Ver o ano` is present.
  - `today-rails`: renders children, a left `aside` labelled `Efeito composto` and a right `aside` labelled `Calendário`, both with classes `hidden` and `2xl:block`.
  - `page.test.tsx`: a user with an objective but no goal this week (S2b) and a user with a goal this week (S3) both see the `Calendário` aside; the no-objective case still redirects to `/quiz`.
- [ ] **Step 2: Run** `npx vitest run src/components/month-dots.test.tsx src/components/today-rails.test.tsx src/app/page.test.tsx` — FAIL.
- [ ] **Step 3: Implement**
  - `MonthDots` takes the current month's dots from `data.dots` by `getMonthDays(now)` keys; 7-column grid of `Dot size="md"`; Y = days up to today.
  - `TodayRails`: a wrapper that keeps the existing `<main>` classes for the content and places two ~170 px `aside`s outside its width from `2xl` (e.g. a `2xl:grid 2xl:grid-cols-[170px_minmax(0,1fr)_170px]` around the main, or `sticky` asides); below `2xl` the asides are `hidden` and the content renders as today.
  - `page.tsx`: call `getDayDots()` in the S3 branch and in the S2/S2b branch (after the S1 redirect, so the quiz redirect does no extra reads), and wrap each `<main>` in `TodayRails`.
- [ ] **Step 4: Run** the three test files — PASS.
- [ ] **Step 5: Commit** `feat: show the compound effect and dot calendar beside Today on wide screens`.

### Task 7: Full verification

- [ ] **Step 1:** `npm run lint` and `npx tsc --noEmit` — no errors.
- [ ] **Step 2:** `npm run test:tz` — all tests pass in UTC and America/Sao_Paulo.
- [ ] **Step 3:** With the user's own `npm run dev` already running (do not start a build), check `/` at 1536 px and 1920 px, at a narrower desktop (1280 px: no rails) and in light and dark themes; open `Ver o ano`, move to a previous year. Screenshot for the user.
- [ ] **Step 4:** Commit any fixes; then ask the user before pushing and opening the PR to `develop` (`Closes #74`, repo template, attribution block, board #2).
