# Fixed Brasília Time Zone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every calendar computation (today, weeks, day chips, task days, displayed dates) uses `America/Sao_Paulo`, whatever time zone the server or browser runs in, so the live site (Vercel, UTC) stops shifting days.

**Architecture:**
- **One module:** `src/lib/dates.ts` is the only place that knows about time zones. It wraps date-fns v4 functions with the `{ in: tz(APP_TIME_ZONE) }` context from `@date-fns/tz`.
- **No raw date math elsewhere:** every other file calls the module's helpers instead of date-fns day/week functions or `new Date()` "as today". A guard test enforces this.
- **Dual time zone runs:** the suite runs under `TZ=UTC` and under `TZ=America/Sao_Paulo`.
- **Data repair:** an opt-in script repairs rows written by the old code on the UTC server.

**Tech Stack:** Next.js 16, date-fns 4.4 + `@date-fns/tz` 1.5, Prisma 6, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-fuso-brasilia-design.md`

## Global Constraints

- **App time zone:** `APP_TIME_ZONE = 'America/Sao_Paulo'`. Weeks start on Monday (`weekStartsOn: 1`), as today.
- **Calendar values:** a calendar day is stored as the instant of 00:00 in Brasília. For example, 05/10/2026 is `2026-10-05T03:00:00.000Z`.
- **Timestamps:** `completedAt`, `createdAt`, `lastSeenAt`, sessions and funnel events stay true instants. Do not change them.
- **No schema change.**
- **Raw date-fns calls:** only `src/lib/dates.ts` may import `startOfDay`, `endOfDay`, `startOfWeek`, `endOfWeek`, `isSameDay`, `parseISO`, `differenceInCalendarDays`, `differenceInCalendarWeeks`, `setHours` or `isToday` from `date-fns`, or call `format(…, 'yyyy-MM-dd')`. Pure arithmetic such as `addDays` and `addWeeks` must also go through the module when the result is a calendar day.
- **Both time zones pass:** the full suite must pass under `TZ=UTC` and under `TZ=America/Sao_Paulo`.
- **Repo rules:**
  - Read `node_modules/next/dist/docs` before writing Next-specific code.
  - `'use server'` files export only async functions.
  - Theme tokens only.
  - Real Postgres test DB; tests run sequentially.
  - Never kill processes and never run `next build` while a dev server is running.
  - Detailed commits via a message file, ending with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Live data:** the repair script never writes to a database unless it is given `--apply`. Running it on the live database needs the user's explicit go-ahead.

## Review Focus

1. **Around midnight UTC (21:00–23:59 in Brasília):** "today" must still be the Brasília day. This is pinned in Task 1 (`appToday` under `TZ=UTC` at `2026-10-07T01:30Z`) and in Task 2 (the summary and Hoje queries use the Brasília day bounds).
2. **Daylight-saving history:** `America/Sao_Paulo` has no DST since 2019, but past dates may still carry an old offset. Day keys must round-trip for any date, which is pinned in Task 1 (round-trip over a 2018 date).
3. **Weeks crossing a month or year boundary:** `getWeekDays` for the week of 29/12/2025 must yield 29/12 to 04/01. Pinned in Task 1.
4. **A date input from forms (`yyyy-MM-dd`) parsed on a UTC server:** it must become 00:00 in Brasília, not in UTC. Pinned in Task 2 (`readDate`).
5. **Rows written before the fix, at 00:00Z:** they must be listed by the repair script's dry run and left untouched without `--apply`. Rows already at 03:00Z must never be moved. Pinned in Task 5.

---

## File Structure

- `src/lib/dates.ts` (modify): the time zone API, the only date-fns day/week user.
- `scripts/test-both-tz.mjs` (create): runs vitest under both time zones; `package.json` gets `test:tz`.
- `src/lib/dates-guard.test.ts` (create): fails if raw day/week date-fns calls appear outside `dates.ts`.
- `scripts/fix-shifted-dates.ts` (create) and `src/lib/shifted-dates.ts` (create): pure detection and repair logic plus the CLI wrapper.
- Every file in the spec's "Files to migrate" list (modify).
- `README.md` (modify).

---

### Task 1: Time zone core in `dates.ts` and the dual time zone test run

**Files:**
- Modify: `package.json` (dependency `@date-fns/tz`, script `test:tz`), `src/lib/dates.ts`
- Create: `scripts/test-both-tz.mjs`
- Test: `src/lib/dates.test.ts` (extend)

**Interfaces:**
- Produces, from `@/lib/dates`:
  - `APP_TIME_ZONE: 'America/Sao_Paulo'`
  - `appToday(now?: Date): Date`, returning 00:00 of the current Brasília day
  - `parseDay(key: string): Date`, which throws `RangeError` on an invalid key
  - `formatDayKey(date: Date): string`, returning `yyyy-MM-dd` in Brasília
  - `startOfAppDay(date: Date): Date` and `endOfAppDay(date: Date): Date`
  - `isSameAppDay(a: Date, b: Date): boolean`
  - `addAppDays(date: Date, n: number): Date` and `addAppWeeks(date: Date, n: number): Date`
  - `appDayOfMonth(date: Date): number`
  - `differenceInAppDays(a: Date, b: Date): number`
  - `differenceInAppWeeks(a: Date, b: Date): number`, counting calendar weeks starting Monday
  - `atAppHour(date: Date, hour: number): Date`
  - `getWeekBounds(date: Date)` and `getWeekDays(weekStart: Date)`, same signatures as today, now computed in Brasília
  - `formatDate(date)` and `formatDayMonth(date)`, now formatted in Brasília

- [ ] **Step 1: Install the dependency**

Run: `npm install @date-fns/tz@^1.5.0`
Expected: it appears under `dependencies`.

- [ ] **Step 2: Write the failing tests** (append to `src/lib/dates.test.ts`)

```ts
import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  APP_TIME_ZONE, appToday, parseDay, formatDayKey, startOfAppDay, endOfAppDay, isSameAppDay,
  addAppDays, appDayOfMonth, differenceInAppWeeks, getWeekBounds, getWeekDays, formatDayMonth,
} from '@/lib/dates'

afterEach(() => vi.useRealTimers())

describe('Brasília calendar (holds under TZ=UTC and TZ=America/Sao_Paulo)', () => {
  it('uses America/Sao_Paulo', () => {
    expect(APP_TIME_ZONE).toBe('America/Sao_Paulo')
  })

  it('a day key means 00:00 in Brasília', () => {
    expect(parseDay('2026-10-05').toISOString()).toBe('2026-10-05T03:00:00.000Z')
    expect(formatDayKey(parseDay('2026-10-05'))).toBe('2026-10-05')
  })

  it('round-trips day keys across old DST offsets and year ends', () => {
    for (const key of ['2018-11-04', '2018-02-17', '2025-12-31', '2026-01-01']) {
      expect(formatDayKey(parseDay(key))).toBe(key)
    }
  })

  it('rejects invalid keys', () => {
    expect(() => parseDay('nope')).toThrow(RangeError)
  })

  it('"today" is the Brasília day even after 21:00 when UTC has rolled over', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-07T01:30:00Z')) // 22:30 on 06/10 in Brasília
    expect(formatDayKey(appToday())).toBe('2026-10-06')
  })

  it('week bounds and days follow Brasília, Monday first', () => {
    const { weekStart, weekEnd } = getWeekBounds(parseDay('2026-10-07'))
    expect(formatDayKey(weekStart)).toBe('2026-10-05')
    expect(formatDayKey(weekEnd)).toBe('2026-10-11')
    expect(getWeekDays(weekStart).map(appDayOfMonth)).toEqual([5, 6, 7, 8, 9, 10, 11])
  })

  it('builds weeks across a year boundary', () => {
    const days = getWeekDays(getWeekBounds(parseDay('2025-12-31')).weekStart).map(formatDayKey)
    expect(days[0]).toBe('2025-12-29')
    expect(days[6]).toBe('2026-01-04')
  })

  it('compares and steps days in Brasília', () => {
    const d = parseDay('2026-10-05')
    expect(isSameAppDay(d, new Date('2026-10-06T02:59:00Z'))).toBe(true)
    expect(isSameAppDay(d, new Date('2026-10-06T03:00:00Z'))).toBe(false)
    expect(formatDayKey(addAppDays(d, 1))).toBe('2026-10-06')
    expect(startOfAppDay(new Date('2026-10-06T01:00:00Z')).toISOString()).toBe('2026-10-05T03:00:00.000Z')
    expect(endOfAppDay(d).toISOString()).toBe('2026-10-06T02:59:59.999Z')
    expect(differenceInAppWeeks(parseDay('2026-10-12'), parseDay('2026-10-05'))).toBe(1)
  })

  it('displays in Brasília', () => {
    expect(formatDayMonth(new Date('2026-10-05T03:00:00Z'))).toBe('05/10')
    expect(formatDayMonth(new Date('2026-10-06T02:00:00Z'))).toBe('05/10')
  })
})
```

- [ ] **Step 3: Create `scripts/test-both-tz.mjs` and the script, then run it to see the failures**

```js
// Runs the suite once per time zone: UTC is the Vercel server, Sao_Paulo is a local machine.
import { spawnSync } from 'node:child_process'

const extra = process.argv.slice(2)
let failed = false
for (const tz of ['UTC', 'America/Sao_Paulo']) {
  console.log(`\n=== TZ=${tz} ===`)
  const run = spawnSync('npx', ['vitest', 'run', ...extra], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, TZ: tz },
  })
  if (run.status !== 0) failed = true
}
process.exit(failed ? 1 : 0)
```

In `package.json` scripts, add `"test:tz": "node scripts/test-both-tz.mjs"`.

Run: `npm run test:tz -- src/lib/dates.test.ts`
Expected: FAIL. The new exports are missing, and under `TZ=UTC` the old functions compute in UTC.

- [ ] **Step 4: Implement `src/lib/dates.ts`**

```ts
import {
  addDays, addWeeks, differenceInCalendarDays, differenceInCalendarWeeks, endOfDay, endOfWeek,
  format, getDate, isSameDay, isValid, parseISO, setHours, startOfDay, startOfWeek,
} from 'date-fns'
import { tz } from '@date-fns/tz'

// Every calendar day in the app is a day in Brasília, wherever the code runs
// (Vercel's servers are on UTC). This module is the only place allowed to do
// day/week math; see dates-guard.test.ts.
export const APP_TIME_ZONE = 'America/Sao_Paulo'
const inApp = { in: tz(APP_TIME_ZONE) }
const week = { ...inApp, weekStartsOn: 1 as const }

// date-fns returns TZDate here; Prisma and React want plain Dates.
const plain = (date: Date) => new Date(date.getTime())

export function appToday(now: Date = new Date()): Date {
  return plain(startOfDay(now, inApp))
}

export function parseDay(key: string): Date {
  const date = parseISO(key, inApp)
  if (!isValid(date)) throw new RangeError(`Invalid day: ${key}`)
  return plain(startOfDay(date, inApp))
}

export function formatDayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd', inApp)
}

export const startOfAppDay = (date: Date) => plain(startOfDay(date, inApp))
export const endOfAppDay = (date: Date) => plain(endOfDay(date, inApp))
export const isSameAppDay = (a: Date, b: Date) => isSameDay(a, b, inApp)
export const addAppDays = (date: Date, n: number) => plain(addDays(date, n, inApp))
export const addAppWeeks = (date: Date, n: number) => plain(addWeeks(date, n, inApp))
export const appDayOfMonth = (date: Date) => getDate(date, inApp)
export const differenceInAppDays = (a: Date, b: Date) => differenceInCalendarDays(a, b, inApp)
export const differenceInAppWeeks = (a: Date, b: Date) => differenceInCalendarWeeks(a, b, week)
export const atAppHour = (date: Date, hour: number) => plain(setHours(startOfDay(date, inApp), hour, inApp))

export function getWeekBounds(date: Date): { weekStart: Date; weekEnd: Date } {
  return { weekStart: plain(startOfWeek(date, week)), weekEnd: plain(endOfWeek(date, week)) }
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addAppDays(weekStart, i))
}

// Display goes through Intl so the locale owns separators and ordering.
const fullDate = new Intl.DateTimeFormat('pt-BR', { timeZone: APP_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' })
const dayMonth = new Intl.DateTimeFormat('pt-BR', { timeZone: APP_TIME_ZONE, day: '2-digit', month: '2-digit' })

export function formatDate(date: Date): string {
  return fullDate.format(date)
}

export function formatDayMonth(date: Date): string {
  return dayMonth.format(date)
}
```

If a date-fns v4 function in this list doesn't accept the `in` option, check its typings in `node_modules/date-fns` and use the `TZDate` constructor from `@date-fns/tz` instead. Keep the exported behavior that the tests pin.

- [ ] **Step 5: Run the tests in both time zones**

Run: `npm run test:tz -- src/lib/dates.test.ts`
Expected: PASS under both time zones.

- [ ] **Step 6: Commit**

Commit message: "feat: Brasília time zone core in dates.ts and a dual-TZ test run".

---

### Task 2: Server side uses the Brasília calendar

**Files (modify):**
- `src/lib/actions/{validation,dailyTasks,summary,quiz,objectives,weeklyGoals,progress,stats}.ts`
- `src/lib/{objectives,objective-dashboard,stats}.ts`, `src/lib/quiz/build-plan.ts`
- `src/lib/guest/{demo-data,seed}.ts`
- `src/app/page.tsx`, `src/app/objectives/page.tsx`
- Each module's existing tests

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces: unchanged public signatures. `readDate(formData, field)` now returns `parseDay(key)`.

**Replacement table.** Apply it in every listed file. `rg -n "startOfDay|endOfDay|isSameDay|parseISO|startOfWeek|endOfWeek|differenceInCalendar|setHours|isAfter|format\(" src/lib src/app` lists the call sites, about 60.

| Old | New |
|---|---|
| `startOfDay(x)` / `endOfDay(x)` | `startOfAppDay(x)` / `endOfAppDay(x)` |
| `startOfDay(new Date())`, or `new Date()` used as "today" | `appToday()` |
| `isSameDay(a, b)` | `isSameAppDay(a, b)` |
| `parseISO(key)` for a day key | `parseDay(key)` |
| `format(d, 'yyyy-MM-dd')` | `formatDayKey(d)` |
| `format(d, 'dd/MM')` | `formatDayMonth(d)` |
| `addDays` / `addWeeks` producing a calendar day | `addAppDays` / `addAppWeeks` |
| `differenceInCalendarDays` / `differenceInCalendarWeeks(…, { weekStartsOn: 1 })` | `differenceInAppDays` / `differenceInAppWeeks` |
| `setHours(date, h)` on a calendar day | `atAppHour(date, h)` |
| `isAfter(today, date)` with both calendar days | `formatDayKey(today) > formatDayKey(date)` or `differenceInAppDays(today, date) > 0` |

Timestamps keep `new Date()`: `completedAt: new Date()` in `toggleDailyTask`/`completeObjective`, and `createdAt`, `lastSeenAt`, sessions, throttle and cleanup.

- [ ] **Step 1: Write the failing regression tests**

Add to `src/lib/actions/validation.test.ts`:

```ts
it('reads a form day as 00:00 in Brasília', () => {
  const fd = new FormData()
  fd.set('date', '2026-10-05')
  expect(readDate(fd, 'date').toISOString()).toBe('2026-10-05T03:00:00.000Z')
})
```

Add to `src/lib/actions/summary.test.ts` (fake timers as in the file):

```ts
it('counts the Brasília day at 22:30 even though UTC is already the next day', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-07T01:30:00Z'))
  const objective = await prisma.objective.create({ data: { userId: TEST_USER_ID, title: 'O', startDate: parseDay('2026-10-01') } })
  const { weekStart, weekEnd } = getWeekBounds(parseDay('2026-10-06'))
  const goal = await prisma.weeklyGoal.create({ data: { title: 'G', objectiveId: objective.id, weekStart, weekEnd } })
  await prisma.dailyTask.create({ data: { title: 'hoje', weeklyGoalId: goal.id, date: parseDay('2026-10-06') } })
  await prisma.dailyTask.create({ data: { title: 'amanhã', weeklyGoalId: goal.id, date: parseDay('2026-10-07') } })
  expect(await getTodaySummary()).toMatchObject({ total: 1 })
  vi.useRealTimers()
})
```

Add to `src/lib/actions/dailyTasks.test.ts`: `createDailyTasks` with `dates=2026-10-05` stores `2026-10-05T03:00:00.000Z`, and `listDailyTasksByDate(parseDay('2026-10-05'))` returns it.

Add to `src/lib/actions/weeklyGoals.test.ts`: `createWeeklyGoal` with `weekOf=2026-10-07` stores `weekStart` `2026-10-05T03:00:00.000Z`.

- [ ] **Step 2: Run them under UTC to see them fail**

Run: `npm run test:tz -- src/lib/actions/validation.test.ts src/lib/actions/summary.test.ts src/lib/actions/dailyTasks.test.ts src/lib/actions/weeklyGoals.test.ts`
Expected: FAIL under `TZ=UTC`.

- [ ] **Step 3: Migrate the files with the replacement table**

Go file by file: `validation.ts` first, which fixes every form, then the actions, the libs, `demo-data.ts`/`seed.ts`, and finally the two pages.

- **Existing test fixtures** that build days with `new Date(2026, 9, 1)` or `new Date('2026-07-28T00:00:00')`: these mean local midnight, which differs between the two runs. Switch them to `parseDay('…')` wherever the assertion depends on the day.
- **Fake timers** in existing tests set "now" with `new Date(y, m, d, h)`: switch to an explicit UTC instant, for example `new Date('2026-10-01T18:00:00Z')` for 15:00 in Brasília.

- [ ] **Step 4: Run the whole suite in both time zones**

Run: `npm run test:tz`
Expected: PASS in both.
- **A test fails only under one time zone:** it still uses local-time construction. Fix the test fixture, or fix the code if the code is at fault.
- **`npx tsc --noEmit`:** must be clean.

- [ ] **Step 5: Commit**

Commit message: "fix: compute days and weeks in Brasília on the server". List the files and that `readDate` now parses in Brasília.

---

### Task 3: Client components and edit pages use the Brasília calendar

**Files (modify):**
- `src/components/{weekly-goal-tasks,task-item,past-week-row,weekly-goal-day-chart,week-goal-progress-card,onboarding-quiz}.tsx`
- `src/app/objectives/[id]/edit/page.tsx`, `src/app/objectives/[id]/weeks/[weekId]/edit/page.tsx`, `src/app/objectives/[id]/weeks/[weekId]/tasks/[taskId]/edit/page.tsx`
- Their tests

**Interfaces:**
- Consumes: Task 1.
- Produces: no signature changes.

Apply the same replacement table as Task 2. Day chips: `format(day, 'd')` becomes `appDayOfMonth(day)`, and `format(day, 'dd')` becomes `String(appDayOfMonth(day)).padStart(2, '0')`. "Today" in a client component becomes `appToday()`.

- [ ] **Step 1: Write the failing regression test** (in `src/components/weekly-goal-card.test.tsx`)

```tsx
it('day chips of the week of 05/10 are SEG 5 … DOM 11 and SEG submits 2026-10-05', async () => {
  const goal = {
    ...baseGoal,
    weekStart: parseDay('2026-10-05'),
    weekEnd: getWeekBounds(parseDay('2026-10-05')).weekEnd,
    dailyTasks: [],
  }
  const onCreateTasks = vi.fn().mockResolvedValue(undefined)
  render(
    <WeeklyGoalCard goal={goal} expanded={false} onToggleExpand={vi.fn()} onCreateTasks={onCreateTasks} onDelete={vi.fn()}
      onToggleTask={vi.fn()} onUpdateTask={vi.fn()} onDeleteTask={vi.fn()} />,
  )
  await openNewTaskForm()
  expect(screen.getByRole('checkbox', { name: 'SEG 5' })).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'DOM 11' })).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Nova tarefa'), 'Teste')
  await userEvent.click(screen.getByRole('checkbox', { name: 'SEG 5' }))
  await userEvent.click(screen.getByRole('button', { name: /^criar$/i }))
  expect((onCreateTasks.mock.calls[0][0] as FormData).getAll('dates')).toContain('2026-10-05')
})
```

Add to `src/components/task-item.test.tsx`: the day select for a task on `parseDay('2026-10-06')` in the week of `parseDay('2026-10-05')` has the value `2026-10-06`, with options SEG 05 to DOM 11.

- [ ] **Step 2: Run it under UTC to see it fail**

Run: `npm run test:tz -- src/components/weekly-goal-card.test.tsx src/components/task-item.test.tsx`
Expected: FAIL under `TZ=UTC`, where the chips start at DOM 4.

- [ ] **Step 3: Migrate the components and edit pages**

- [ ] **Step 4: Run the whole suite in both time zones and run `tsc`**

Run: `npm run test:tz` and `npx tsc --noEmit`
Expected: PASS and clean.

- [ ] **Step 5: Commit**

Commit message: "fix: day chips, task days and edit forms follow Brasília in the browser".

---

### Task 4: Guard test and README note

**Files:**
- Create: `src/lib/dates-guard.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the guard test**

```ts
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Day/week math outside src/lib/dates.ts silently uses the machine's time
// zone, which is UTC on Vercel and Brasília locally. Keep it in one place.
const FORBIDDEN = /\b(startOfDay|endOfDay|startOfWeek|endOfWeek|isSameDay|parseISO|differenceInCalendarDays|differenceInCalendarWeeks|setHours|isToday)\b|format\([^)]*'yyyy-MM-dd'\)/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('date math stays in src/lib/dates.ts', () => {
  it('no other source file uses day/week date-fns functions directly', () => {
    const offenders = sourceFiles(join(process.cwd(), 'src'))
      .filter((file) => !file.endsWith(join('lib', 'dates.ts')))
      .filter((file) => FORBIDDEN.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/lib/dates-guard.test.ts`
Expected: PASS. If it lists files, migrate them using Task 2's table, re-run `npm run test:tz`, and include the fixes in this commit.

- [ ] **Step 3: README**

Under "Decisões de projeto", add:

```markdown
- **Fuso horário fixo de Brasília.** Toda data do app é um dia no horário de Brasília (`America/Sao_Paulo`), onde quer que o código rode: o servidor da Vercel fica em UTC, e sem isso as tarefas mudavam de dia. Um único módulo (`src/lib/dates.ts`) faz as contas de dia e semana, um teste impede contas fora dele, e a suíte roda em UTC e em Brasília (`npm run test:tz`). Quem acessa de outro país vê o "hoje" de Brasília.
```

Under "Testes", add a line: "`npm run test:tz` roda a suíte em UTC e no horário de Brasília."

- [ ] **Step 4: Commit**

Commit message: "test: guard date math to dates.ts; docs: fixed Brasília time zone in the README".

---

### Task 5: Repair script for rows written before the fix (dry run by default)

**Files:**
- Create: `src/lib/shifted-dates.ts` (pure logic), `scripts/fix-shifted-dates.ts` (CLI)
- Test: `src/lib/shifted-dates.test.ts`
- Modify: `package.json` (script `db:fix-shifted-dates`)

**Context:**
- **What the old code wrote:** on the UTC server, every calendar value was stored at `00:00:00.000Z` of the intended `yyyy-MM-dd`: day chips, form dates and `startOfWeek`. The same is true of `weekEnd`, at `23:59:59.999Z` of the Sunday.
- **The repair:** move each such value to 00:00 in Brasília of the same `yyyy-MM-dd` (`parseDay(isoDatePart)`), and recompute `weekEnd` from the repaired `weekStart` with `getWeekBounds`.
- **What stays put:** values already at 03:00Z, written locally or after the fix.

**Interfaces:**
- Produces:
  - `isUtcMidnight(date: Date): boolean`
  - `repairedDay(date: Date): Date`, which is `parseDay(date.toISOString().slice(0, 10))`
  - `planRepair(db: PrismaClient): Promise<{ tasks: number; goals: number; objectives: number }>`
  - `applyRepair(db: PrismaClient): Promise<…same counts>`

  Both repair functions skip users with `isAnonymous: true`.

- [ ] **Step 1: Write the failing tests** (real test DB)

```ts
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { applyRepair, isUtcMidnight, planRepair, repairedDay } from '@/lib/shifted-dates'
import { parseDay } from '@/lib/dates'
import { TEST_USER_ID } from '@/test/session-mock'

describe('shifted dates repair', () => {
  it('recognises rows written at 00:00Z and maps them to the same day in Brasília', () => {
    expect(isUtcMidnight(new Date('2026-10-04T00:00:00Z'))).toBe(true)
    expect(isUtcMidnight(parseDay('2026-10-04'))).toBe(false)
    expect(repairedDay(new Date('2026-10-04T00:00:00Z')).toISOString()).toBe('2026-10-04T03:00:00.000Z')
  })

  it('dry run counts but changes nothing; apply fixes only old rows', async () => {
    const objective = await prisma.objective.create({
      data: { userId: TEST_USER_ID, title: 'O', startDate: new Date('2026-10-05T00:00:00Z') },
    })
    const goal = await prisma.weeklyGoal.create({
      data: { title: 'G', objectiveId: objective.id, weekStart: new Date('2026-10-05T00:00:00Z'), weekEnd: new Date('2026-10-11T23:59:59.999Z') },
    })
    const old = await prisma.dailyTask.create({ data: { title: 'old', weeklyGoalId: goal.id, date: new Date('2026-10-06T00:00:00Z') } })
    const fresh = await prisma.dailyTask.create({ data: { title: 'new', weeklyGoalId: goal.id, date: parseDay('2026-10-07') } })

    expect(await planRepair(prisma)).toEqual({ tasks: 1, goals: 1, objectives: 1 })
    expect((await prisma.dailyTask.findUniqueOrThrow({ where: { id: old.id } })).date.toISOString()).toBe('2026-10-06T00:00:00.000Z')

    await applyRepair(prisma)
    expect((await prisma.dailyTask.findUniqueOrThrow({ where: { id: old.id } })).date.toISOString()).toBe('2026-10-06T03:00:00.000Z')
    expect((await prisma.dailyTask.findUniqueOrThrow({ where: { id: fresh.id } })).date.toISOString()).toBe('2026-10-07T03:00:00.000Z')
    const g = await prisma.weeklyGoal.findUniqueOrThrow({ where: { id: goal.id } })
    expect(g.weekStart.toISOString()).toBe('2026-10-05T03:00:00.000Z')
    expect(g.weekEnd.toISOString()).toBe('2026-10-12T02:59:59.999Z')
    expect(await planRepair(prisma)).toEqual({ tasks: 0, goals: 0, objectives: 0 })
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/shifted-dates.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

`src/lib/shifted-dates.ts`:
- **Rows to repair:** load non-anonymous users' rows, selecting only ids and date fields:
  - `DailyTask.date`;
  - `WeeklyGoal.weekStart`, with `weekEnd` recomputed;
  - `Objective.startDate` and `targetDate`. `completedAt` is a timestamp and is left alone.

  Filter them with `isUtcMidnight`.
- **`planRepair`:** returns the counts.
- **`applyRepair`:** updates each row inside one `$transaction` (`{ timeout: 60_000 }`) and returns the counts.

`scripts/fix-shifted-dates.ts`:
1. Creates a `PrismaClient`.
2. Prints which database host it is connected to, from `DATABASE_URL`, without the password.
3. Runs `planRepair` and prints the counts.
4. Only when `process.argv.includes('--apply')`, runs `applyRepair` and prints "Corrigido".

Add `"db:fix-shifted-dates": "tsx scripts/fix-shifted-dates.ts"` to `package.json`. If `tsx` isn't installed, use `node --experimental-strip-types` (Node ≥ 22.6) and say which one you used.

- [ ] **Step 4: Run the tests, then the suite in both time zones**

Run: `npx vitest run src/lib/shifted-dates.test.ts`, then `npm run test:tz`
Expected: PASS.

- [ ] **Step 5: Dry run locally**

Run: `npm run db:fix-shifted-dates`
This uses the local `.env` dev DB. Expected: counts printed; local rows are mostly at 03:00Z, so they should be 0 or near it. Do not pass `--apply` on anything but the test DB.

- [ ] **Step 6: Commit**

Commit message: "feat: dry-run-first script to repair days written at UTC midnight before the fix".

**After the plan (controller and user, not an implementer step):** release to master once the user approves. Then show the user the dry-run counts against the live database; the user provides or runs it with the Neon URL. Run `--apply` only after the user's explicit go-ahead.
