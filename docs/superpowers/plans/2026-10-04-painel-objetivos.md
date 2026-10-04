# Objectives Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/objectives` into a dashboard. It gets three overview tiles, then one rich card per active objective (8-week bars with tooltips, streak chip, big rate, timeline, "+ Meta da semana", "⋯" menu), then simpler cards for completed objectives.

**Architecture:** Pure derivations live in `src/lib/objective-dashboard.ts` and are unit-tested with an injected `now`. The page (a Server Component) computes them per objective and passes plain props to presentational components. Only the bars (tooltips) and the actions menu (Base UI Menu plus delete dialog) are client components. Delete reaches the client as a bound Server Action prop. No schema change.

**Tech Stack:** Next.js 16 App Router (read `node_modules/next/dist/docs/` before touching Next APIs, per AGENTS.md), React 19, Tailwind CSS 4, Base UI (`@base-ui/react/menu`, existing `ui/dialog`), date-fns, Vitest + Testing Library + user-event.

**Spec:** `docs/superpowers/specs/2026-10-04-painel-objetivos-design.md`

## Global Constraints

- **Branches:** work on `feature/objetivos-painel` (cut from `develop`). Merge into `develop` with `--no-ff`. Never commit to `develop` or `master` directly.
- **Commit messages:** detailed (what changed, files, behavior, tests). The last line is exactly `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Never write another model name there; verify with `git log -1 --format=%B`. On Windows, write the message to a file and run `git commit -F <file>`.
- **Dependencies:** none new.
- **Copy:** Brazilian Portuguese, exactly as written in the spec and this plan.
- **Colors:**
  - No 6- or 8-digit hex color literals in `src/**/*.tsx?`; `src/lib/theme-contrast.test.ts` enforces this.
  - Use theme tokens, and `--glow` for glow.
  - Small primary-colored text uses `text-accent-foreground`, never `text-primary`.
- **Imports:** client components import nothing as values from `@/lib/actions/*` or `@/lib/theme`. Actions arrive as props.
- **Weeks:** Monday start, via `getWeekBounds` from `@/lib/dates`. Dates are displayed with `formatDayMonth` / `formatDate`.
- **Tests:** run the full suite with `npm test`, which needs the Docker Postgres. Four test files have pre-existing TypeScript fixture errors about missing `completedAt`; they are not ours to fix.
- **Builds:** never run `next build` in this folder while the user's dev server may be running. For build verification, use a separate checkout (`git worktree add <scratchpad>/wt <branch>` plus `npm ci` there, or copy `node_modules`). Do not start or stop servers.

## Review Focus

1. **Week matching across DST or timezone offsets:** goal `weekStart` timestamps may not equal `getWeekBounds(now).weekStart` exactly. Matching must use the calendar date (`yyyy-MM-dd`). Pinned in Task 1.
2. **Streak with an unfinished current week:** an in-progress week must not zero the 🔥 streak. Pinned in Task 1.
3. **Objective with no target date, or a target in the past or before the start:** the timeline must not divide by zero or exceed 100%. Pinned in Task 1.
4. **Keyboard users:** bars expose their tooltip on focus, and the "⋯" menu is reachable and closes on Esc. Pinned in Tasks 2 and 3.
5. **Long titles and narrow screens:** titles clamp to 2 lines, and nothing scrolls horizontally at 375px. Checked manually in Task 6; Task 4 asserts the `line-clamp-2` class.

---

### Task 1: Pure dashboard derivations

**Files:**
- Create: `src/lib/objective-dashboard.ts`
- Create: `src/lib/objective-dashboard.test.ts`

**Interfaces:**
- Consumes:
  - `ObjectiveWeek` from `@/lib/objectives` (`{ weekStart: Date; total: number; completed: number; fulfilled: boolean }`)
  - `getWeekBounds` from `@/lib/dates`
  - the type `ObjectiveWithStats` from `@/lib/actions/objectives` (type-only import)
- Produces:
  - `type DashboardWeek = ObjectiveWeek & { percent: number; hasGoal: boolean; current: boolean }`
  - `calendarWeeks(weeks: ObjectiveWeek[], now: Date, count?: number): DashboardWeek[]`
  - `streak(weeks: ObjectiveWeek[], now: Date): number`
  - `recentRate(weeks: DashboardWeek[]): number | null`
  - `type Timeline = { kind: 'open'; weeksActive: number } | { kind: 'dated'; elapsedPercent: number; targetDate: Date; overdue: boolean }`
  - `timeline(startDate: Date, targetDate: Date | null, now: Date): Timeline`
  - `overview(active: ObjectiveWithStats[], now: Date): { activeCount: number; weeksFulfilled: number; recentRate: number | null }`
  - `const DASHBOARD_WEEKS = 8`

- [ ] **Step 1: Write the failing tests** in `src/lib/objective-dashboard.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { calendarWeeks, overview, recentRate, streak, timeline } from '@/lib/objective-dashboard'
import type { ObjectiveWeek } from '@/lib/objectives'

// Thursday 2026-10-01; its week starts Monday 2026-09-28.
const now = new Date(2026, 9, 1, 15)

function week(y: number, m: number, d: number, completed: number, total: number, fulfilled = completed === total && total > 0): ObjectiveWeek {
  // 03:00 rather than midnight: matching must use the calendar date, not the timestamp.
  return { weekStart: new Date(y, m, d, 3), completed, total, fulfilled }
}

describe('calendarWeeks', () => {
  it('returns 8 calendar weeks ending at the current one, filling weeks without goals', () => {
    const weeks = calendarWeeks([week(2026, 8, 28, 2, 4), week(2026, 8, 14, 5, 5)], now)

    expect(weeks).toHaveLength(8)
    expect(weeks[7].weekStart.getDate()).toBe(28)
    expect(weeks[7]).toMatchObject({ completed: 2, total: 4, percent: 50, hasGoal: true, current: true, fulfilled: false })
    expect(weeks[6]).toMatchObject({ hasGoal: false, total: 0, percent: 0, current: false })
    expect(weeks[5]).toMatchObject({ percent: 100, fulfilled: true, hasGoal: true })
    expect(weeks[0].weekStart.getDate()).toBe(10) // 2026-08-10
    expect(weeks.every((w) => w.weekStart.getDay() === 1)).toBe(true)
  })

  it('accepts a custom count', () => {
    expect(calendarWeeks([], now, 3)).toHaveLength(3)
  })
})

describe('streak', () => {
  it('counts consecutive fulfilled weeks before the current one', () => {
    const weeks = [week(2026, 8, 7, 3, 3), week(2026, 8, 14, 3, 3), week(2026, 8, 21, 4, 4), week(2026, 8, 28, 1, 4)]
    expect(streak(weeks, now)).toBe(3)
  })

  it('counts the current week when it is already fulfilled', () => {
    const weeks = [week(2026, 8, 21, 4, 4), week(2026, 8, 28, 4, 4)]
    expect(streak(weeks, now)).toBe(2)
  })

  it('is broken by a week without a goal', () => {
    const weeks = [week(2026, 8, 7, 3, 3), week(2026, 8, 21, 4, 4)]
    expect(streak(weeks, now)).toBe(1)
  })

  it('is broken by an unfulfilled week', () => {
    const weeks = [week(2026, 8, 14, 3, 3), week(2026, 8, 21, 2, 4)]
    expect(streak(weeks, now)).toBe(0)
  })

  it('is zero without history', () => {
    expect(streak([], now)).toBe(0)
  })
})

describe('recentRate', () => {
  it('pools task counts across weeks instead of averaging percentages', () => {
    const weeks = calendarWeeks([week(2026, 8, 28, 1, 1), week(2026, 8, 21, 0, 9)], now)
    expect(recentRate(weeks)).toBe(10)
  })

  it('is null when nothing was planned', () => {
    expect(recentRate(calendarWeeks([], now))).toBeNull()
  })
})

describe('timeline', () => {
  it('reports how much of the window has elapsed', () => {
    const t = timeline(new Date(2026, 8, 1, 15), new Date(2026, 9, 31, 15), now)
    expect(t).toMatchObject({ kind: 'dated', overdue: false })
    expect(t.kind === 'dated' && t.elapsedPercent).toBe(50)
  })

  it('clamps to 100 and flags an overdue target', () => {
    const t = timeline(new Date(2026, 0, 1), new Date(2026, 5, 1), now)
    expect(t).toMatchObject({ kind: 'dated', elapsedPercent: 100, overdue: true })
  })

  it('never divides by zero when the target is not after the start', () => {
    const t = timeline(new Date(2026, 9, 1), new Date(2026, 9, 1), now)
    expect(t.kind === 'dated' && Number.isFinite(t.elapsedPercent)).toBe(true)
  })

  it('counts active weeks when there is no target date', () => {
    expect(timeline(new Date(2026, 8, 14), null, now)).toEqual({ kind: 'open', weeksActive: 3 })
    expect(timeline(new Date(2026, 9, 1), null, now)).toEqual({ kind: 'open', weeksActive: 1 })
  })
})

describe('overview', () => {
  it('sums fulfilled weeks and pools the 8-week rate across active objectives', () => {
    const base = { description: null, targetDate: null, status: 'ACTIVE' as const, completedAt: null, createdAt: now, startDate: now }
    const result = overview(
      [
        { ...base, id: 'a', title: 'A', stats: { weeksFulfilled: 3, tasksCompleted: 0, weeksSinceStart: 1, recentWeeks: [week(2026, 8, 28, 3, 4)] } },
        { ...base, id: 'b', title: 'B', stats: { weeksFulfilled: 2, tasksCompleted: 0, weeksSinceStart: 1, recentWeeks: [week(2026, 8, 21, 1, 6)] } },
      ],
      now,
    )
    expect(result).toEqual({ activeCount: 2, weeksFulfilled: 5, recentRate: 40 })
  })

  it('has no rate when nothing was planned', () => {
    expect(overview([], now)).toEqual({ activeCount: 0, weeksFulfilled: 0, recentRate: null })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.** Run `npx vitest run src/lib/objective-dashboard.test.ts`. Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement `src/lib/objective-dashboard.ts`:**

```ts
import { differenceInCalendarWeeks, format, subWeeks } from 'date-fns'
import { getWeekBounds } from '@/lib/dates'
import type { ObjectiveWeek } from '@/lib/objectives'
import type { ObjectiveWithStats } from '@/lib/actions/objectives'

export const DASHBOARD_WEEKS = 8
const STREAK_HORIZON = 26

export type DashboardWeek = ObjectiveWeek & { percent: number; hasGoal: boolean; current: boolean }

export type Timeline =
  | { kind: 'open'; weeksActive: number }
  | { kind: 'dated'; elapsedPercent: number; targetDate: Date; overdue: boolean }

// Calendar date of the week's Monday: goal timestamps need not equal
// getWeekBounds(now) to the millisecond (time of day, DST), only the date.
function weekKey(date: Date): string {
  return format(getWeekBounds(date).weekStart, 'yyyy-MM-dd')
}

export function calendarWeeks(weeks: ObjectiveWeek[], now: Date, count = DASHBOARD_WEEKS): DashboardWeek[] {
  const byWeek = new Map(weeks.map((w) => [weekKey(w.weekStart), w]))
  const currentStart = getWeekBounds(now).weekStart

  return Array.from({ length: count }, (_, i) => {
    const weekStart = subWeeks(currentStart, count - 1 - i)
    const found = byWeek.get(weekKey(weekStart))
    const total = found?.total ?? 0
    const completed = found?.completed ?? 0
    return {
      weekStart,
      total,
      completed,
      fulfilled: found?.fulfilled ?? false,
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
      hasGoal: found !== undefined,
      current: i === count - 1,
    }
  })
}

export function streak(weeks: ObjectiveWeek[], now: Date): number {
  const recent = calendarWeeks(weeks, now, STREAK_HORIZON)
  let count = 0
  let i = recent.length - 1
  // The current week is still in progress: it can extend the streak but not end it.
  if (recent[i].fulfilled) count++
  for (i -= 1; i >= 0 && recent[i].fulfilled; i--) count++
  return count
}

export function recentRate(weeks: DashboardWeek[]): number | null {
  const total = weeks.reduce((sum, w) => sum + w.total, 0)
  if (total === 0) return null
  const completed = weeks.reduce((sum, w) => sum + w.completed, 0)
  return Math.round((completed / total) * 100)
}

export function timeline(startDate: Date, targetDate: Date | null, now: Date): Timeline {
  if (!targetDate) {
    return { kind: 'open', weeksActive: Math.max(1, differenceInCalendarWeeks(now, startDate, { weekStartsOn: 1 }) + 1) }
  }
  const span = targetDate.getTime() - startDate.getTime()
  const elapsed = now.getTime() - startDate.getTime()
  const raw = span <= 0 ? 100 : (elapsed / span) * 100
  return {
    kind: 'dated',
    elapsedPercent: Math.min(100, Math.max(0, Math.round(raw))),
    targetDate,
    overdue: now.getTime() > targetDate.getTime(),
  }
}

export function overview(active: ObjectiveWithStats[], now: Date) {
  const allWeeks = active.flatMap((objective) => calendarWeeks(objective.stats.recentWeeks, now))
  return {
    activeCount: active.length,
    weeksFulfilled: active.reduce((sum, objective) => sum + objective.stats.weeksFulfilled, 0),
    recentRate: recentRate(allWeeks),
  }
}
```

Check `timeline(new Date(2026, 8, 14), null, now)`: Sep 14 to Oct 1 is 2 calendar weeks apart, plus 1, so 3. Check `timeline(2026-09-01 15:00, 2026-10-31 15:00, now)`: 30 days elapsed out of a 60-day span, so 50. If either test is off by one, fix the arithmetic, never the expected values. The spec defines the meaning.

- [ ] **Step 4: Run the tests to verify they pass.** Expected: all pass.

- [ ] **Step 5: Commit** with a detailed message.

---

### Task 2: Controlled delete dialog and `ObjectiveActionsMenu`

**Files:**
- Modify: `src/components/delete-button.tsx`
- Create: `src/components/objective-actions-menu.tsx`
- Create: `src/components/objective-actions-menu.test.tsx`

**Interfaces:**
- Produces:
  - `DeleteConfirmDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; action: () => Promise<void>; label?: string; confirmDescription?: string })`, exported from `delete-button.tsx`
  - `DeleteButton` keeps its current API
  - `ObjectiveActionsMenu(props: { objectiveId: string; onDelete: () => Promise<void> })`

- [ ] **Step 1: Read first.** Read the current `src/components/delete-button.tsx`, `src/components/delete-button.test.tsx` and `src/components/ui/dialog.tsx`. Then read the Base UI Menu API in `node_modules/@base-ui/react/menu/` (the parts are `Menu.Root`, `Menu.Trigger`, `Menu.Portal`, `Menu.Positioner`, `Menu.Popup` and `Menu.Item`; check the exact names and props in the `.d.ts` files).

- [ ] **Step 2: Write the failing test** in `src/components/objective-actions-menu.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ObjectiveActionsMenu } from '@/components/objective-actions-menu'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

describe('ObjectiveActionsMenu', () => {
  it('offers Editar and Excluir… from a labeled trigger', async () => {
    render(<ObjectiveActionsMenu objectiveId="o1" onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ações do objetivo' }))

    expect(await screen.findByRole('menuitem', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Excluir…' })).toBeInTheDocument()
  })

  it('goes to the edit page from Editar', async () => {
    render(<ObjectiveActionsMenu objectiveId="o1" onDelete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ações do objetivo' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }))

    expect(push).toHaveBeenCalledWith('/objectives/o1/edit')
  })

  it('asks for confirmation before deleting, then calls the action', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(<ObjectiveActionsMenu objectiveId="o1" onDelete={onDelete} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ações do objetivo' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Excluir…' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/todas as metas semanais e tarefas diárias/)).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('closes the menu with Escape', async () => {
    render(<ObjectiveActionsMenu objectiveId="o1" onDelete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ações do objetivo' }))
    await screen.findByRole('menuitem', { name: 'Editar' })

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menuitem', { name: 'Editar' })).not.toBeInTheDocument()
  })
})
```

Editar navigates with `router.push` from the item's click, rather than through a nested `<a>`, so the item keeps Base UI's keyboard semantics.

- [ ] **Step 3: Run the test to verify it fails.**

- [ ] **Step 4: Refactor `delete-button.tsx`.** Move the dialog body (header, description, Cancelar/Excluir footer, `useTransition`) into an exported `DeleteConfirmDialog` with controlled `open`/`onOpenChange`. `DeleteButton` then owns `const [open, setOpen] = useState(false)`, renders its destructive trigger button (`onClick={() => setOpen(true)}`, `disabled` while pending) and `<DeleteConfirmDialog open={open} onOpenChange={setOpen} … />`. Confirming runs the action in a transition and closes the dialog. Keep all current copy and defaults (`label='Excluir'`, `confirmDescription='Esta ação não pode ser desfeita.'`). Run `npx vitest run src/components/delete-button.test.tsx` and confirm it still passes **unchanged**.

- [ ] **Step 5: Implement `objective-actions-menu.tsx`** (client).
  - **Trigger:** an icon button (`MoreHorizontal`, `size-4`, `aria-label="Ações do objetivo"`, `rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary`).
  - **Popup:** `bg-popover text-popover-foreground border border-border rounded-md p-1 shadow-md min-w-36`, aligned to the end under the trigger.
  - **Items:** `px-2 py-1.5 text-sm rounded-sm data-highlighted:bg-accent data-highlighted:text-accent-foreground`.
    - **"Editar"** calls `router.push(`/objectives/${objectiveId}/edit`)`.
    - **"Excluir…"** has `text-destructive` and sets `confirmOpen` to true.
  - **Confirmation:** render `<DeleteConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} action={onDelete} confirmDescription="Isso também excluirá todas as metas semanais e tarefas diárias relacionadas. Esta ação não pode ser desfeita." />`.

- [ ] **Step 6: Run the tests.** Run `npx vitest run src/components/objective-actions-menu.test.tsx src/components/delete-button.test.tsx` and `npm run lint`. Expected: all pass with pristine output.

- [ ] **Step 7: Commit.**

---

### Task 3: `WeeklyBars`

**Files:**
- Create: `src/components/weekly-bars.tsx`
- Create: `src/components/weekly-bars.test.tsx`

**Interfaces:**
- Consumes: `DashboardWeek` (Task 1, type-only) and `formatDayMonth`.
- Produces: `WeeklyBars(props: { weeks: DashboardWeek[]; className?: string })` (client), plus the pure helper `barLabel(week: DashboardWeek): string`, which is exported.

- [ ] **Step 1: Write the failing test** in `src/components/weekly-bars.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeeklyBars, barLabel } from '@/components/weekly-bars'
import type { DashboardWeek } from '@/lib/objective-dashboard'

function w(day: number, completed: number, total: number, extra: Partial<DashboardWeek> = {}): DashboardWeek {
  return {
    weekStart: new Date(2026, 8, day),
    completed,
    total,
    fulfilled: total > 0 && completed === total,
    percent: total ? Math.round((completed / total) * 100) : 0,
    hasGoal: total > 0,
    current: false,
    ...extra,
  }
}

const weeks: DashboardWeek[] = [w(7, 5, 5), w(14, 0, 0), w(21, 3, 5), w(28, 2, 4, { current: true })]

describe('barLabel', () => {
  it('describes fulfilled, partial, empty and current weeks', () => {
    expect(barLabel(weeks[0])).toBe('07/09 · 5/5 ✓')
    expect(barLabel(weeks[1])).toBe('14/09 · sem meta')
    expect(barLabel(weeks[2])).toBe('21/09 · 3/5')
    expect(barLabel(weeks[3])).toBe('28/09 · 2/4 (em andamento)')
  })
})

describe('WeeklyBars', () => {
  it('renders one labeled bar per week inside a named group', () => {
    render(<WeeklyBars weeks={weeks} />)

    expect(screen.getByRole('group', { name: 'Últimas 8 semanas' })).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(4)
    expect(screen.getByRole('img', { name: '21/09 · 3/5' })).toBeInTheDocument()
  })

  it('shows the tooltip on hover and on keyboard focus', async () => {
    render(<WeeklyBars weeks={weeks} />)

    await userEvent.hover(screen.getByRole('img', { name: '07/09 · 5/5 ✓' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('07/09 · 5/5 ✓')

    await userEvent.unhover(screen.getByRole('img', { name: '07/09 · 5/5 ✓' }))
    await userEvent.tab()
    expect(screen.getByRole('tooltip')).toHaveTextContent('07/09 · 5/5 ✓')
    await userEvent.tab()
    expect(screen.getByRole('tooltip')).toHaveTextContent('14/09 · sem meta')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.**

- [ ] **Step 3: Implement `weekly-bars.tsx`** (client, `useState<number | null>` for the active index).
  - **Container:** `role="group" aria-label="Últimas 8 semanas"`, `relative flex h-10 items-end gap-1`, plus `className`.
  - **Bars:** each bar is `<span role="img" aria-label={barLabel(week)} tabIndex={0}>` with `relative flex-1 rounded-t-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50`.
    - **Height:** `style={{ height: week.hasGoal ? `${Math.max(week.percent, 4)}%` : '2px' }}`.
    - **Color:** `bg-linear-to-t from-chart-4 to-primary` when fulfilled, `bg-chart-1` otherwise.
    - **Current week:** add `outline-1 outline-dashed outline-muted-foreground/60`.
    - **Events:** `onMouseEnter` and `onFocus` set the index; `onMouseLeave` and `onBlur` clear it.
  - **Tooltip:** when the index is set, render one `<span role="tooltip">` with `pointer-events-none absolute bottom-full mb-1 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-popover px-1.5 py-0.5 text-[11px] text-popover-foreground shadow`, positioned horizontally at the active bar's center: `left: ((index + 0.5) / weeks.length) * 100 + '%'`.
  - **Helper:** `barLabel` combines `formatDayMonth(weekStart)` with `sem meta`, `c/t` plus ` ✓` when fulfilled, and ` (em andamento)` when current, matching the test strings exactly.

- [ ] **Step 4: Run the tests to verify they pass,** then run lint.

- [ ] **Step 5: Commit.**

---

### Task 4: Cards and overview

**Files:**
- Create: `src/components/objective-dashboard-card.tsx` and `src/components/objective-dashboard-card.test.tsx`
- Create: `src/components/completed-objective-card.tsx`
- Create: `src/components/objectives-overview.tsx` and `src/components/objectives-overview.test.tsx`

**Interfaces:**
- Consumes:
  - `DashboardWeek`, `Timeline` and `recentRate` (Task 1)
  - `WeeklyBars` (Task 3)
  - `ObjectiveActionsMenu` (Task 2)
  - `formatDayMonth`, `formatDate` and `describeSchedule`
- Produces:
  - `ObjectiveDashboardCard(props: { id: string; title: string; startDate: Date; weeks: DashboardWeek[]; streak: number; timeline: Timeline; onDelete: () => Promise<void> })`
  - `CompletedObjectiveCard(props: { id: string; title: string; completedAt: Date; targetDate: Date | null; weeksFulfilled: number; tasksCompleted: number; onDelete: () => Promise<void> })`
  - `ObjectivesOverview(props: { activeCount: number; weeksFulfilled: number; recentRate: number | null })`

- [ ] **Step 1: Write the failing tests.**

`src/components/objectives-overview.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ObjectivesOverview } from '@/components/objectives-overview'

describe('ObjectivesOverview', () => {
  it('shows the three totals', () => {
    render(<ObjectivesOverview activeCount={4} weeksFulfilled={18} recentRate={62} />)
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('objetivos ativos')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('semanas cumpridas')).toBeInTheDocument()
    expect(screen.getByText('62%')).toBeInTheDocument()
    expect(screen.getByText('conclusão média (8 sem.)')).toBeInTheDocument()
  })

  it('shows a dash when nothing was planned', () => {
    render(<ObjectivesOverview activeCount={1} weeksFulfilled={0} recentRate={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
```

`src/components/objective-dashboard-card.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ObjectiveDashboardCard } from '@/components/objective-dashboard-card'
import type { DashboardWeek } from '@/lib/objective-dashboard'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

function weeks(currentHasGoal: boolean): DashboardWeek[] {
  return Array.from({ length: 8 }, (_, i) => ({
    weekStart: new Date(2026, 7, 10 + i * 7),
    completed: i === 7 && !currentHasGoal ? 0 : 3,
    total: i === 7 && !currentHasGoal ? 0 : 4,
    fulfilled: false,
    percent: i === 7 && !currentHasGoal ? 0 : 75,
    hasGoal: i === 7 ? currentHasGoal : true,
    current: i === 7,
  }))
}

const base = {
  id: 'o1',
  title: 'Correr uma maratona',
  startDate: new Date(2026, 5, 1),
  onDelete: vi.fn(),
}

describe('ObjectiveDashboardCard', () => {
  it('links the title, shows the streak, the 8-week rate and the plan shortcut', () => {
    render(
      <ObjectiveDashboardCard
        {...base}
        weeks={weeks(true)}
        streak={3}
        timeline={{ kind: 'dated', elapsedPercent: 62, targetDate: new Date(2026, 10, 15), overdue: false }}
      />,
    )

    expect(screen.getByRole('link', { name: 'Correr uma maratona' })).toHaveAttribute('href', '/objectives/o1')
    expect(screen.getByRole('link', { name: 'Correr uma maratona' })).toHaveClass('line-clamp-2')
    expect(screen.getByText('3 semanas seguidas cumpridas')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('média das últimas 8 semanas')).toBeInTheDocument()
    expect(screen.getByText('início 01/06 · 62% do prazo · meta 15/11')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+ Meta da semana' })).toHaveAttribute('href', '/objectives/o1?nova-meta=1#nova-meta')
    expect(screen.getByRole('button', { name: 'Ações do objetivo' })).toBeInTheDocument()
  })

  it('nudges to plan when the current week has no goal and there is no streak', () => {
    render(<ObjectiveDashboardCard {...base} weeks={weeks(false)} streak={0} timeline={{ kind: 'open', weeksActive: 5 }} />)

    expect(screen.getByText('sem meta nesta semana')).toBeInTheDocument()
    expect(screen.getByText('início 01/06 · ativo há 5 semanas · sem data-meta')).toBeInTheDocument()
  })

  it('shows no chip when there is a goal this week but no streak, and marks an overdue target', () => {
    render(
      <ObjectiveDashboardCard
        {...base}
        weeks={weeks(true)}
        streak={0}
        timeline={{ kind: 'dated', elapsedPercent: 100, targetDate: new Date(2026, 8, 1), overdue: true }}
      />,
    )

    expect(screen.queryByText('sem meta nesta semana')).not.toBeInTheDocument()
    expect(screen.queryByText(/semanas seguidas/)).not.toBeInTheDocument()
    expect(screen.getByText('prazo encerrado')).toBeInTheDocument()
  })

  it('shows a dash when nothing was planned in 8 weeks', () => {
    const empty = weeks(false).map((w) => ({ ...w, completed: 0, total: 0, percent: 0, hasGoal: false }))
    render(<ObjectiveDashboardCard {...base} weeks={empty} streak={0} timeline={{ kind: 'open', weeksActive: 1 }} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('início 01/06 · ativo há 1 semana · sem data-meta')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail.**

- [ ] **Step 3: Implement the three components** per the spec's "Page layout", "ObjectiveDashboardCard" and "CompletedObjectiveCard" sections. Key details:
  - **Streak chip:** the visible text is `🔥 {n} semana(s)`, with the emoji in `<span aria-hidden="true">` and the label in `<span className="sr-only">{n} semana(s) seguidas cumpridas</span>`. The visible count text is `aria-hidden`, so the test's `getByText('3 semanas seguidas cumpridas')` finds the sr-only span.
  - **Plurals:** `1 semana`, `N semanas`. This applies to the streak and to "ativo há".
  - **Timeline:**
    - The `dated` caption is `início {dd/MM} · {elapsedPercent}% do prazo · meta {dd/MM}` as one text node. When `overdue`, it is `início {dd/MM} · {elapsedPercent}% do prazo · ` followed by `<span className="text-destructive">prazo encerrado</span>`.
    - The bar is `h-1.5 rounded-full bg-muted` with an inner `bg-linear-to-r from-support to-primary` at `width: elapsedPercent%`.
  - **Card container classes:** `group/card rounded-lg border border-border bg-card p-4 flex flex-col gap-3 motion-safe:transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[0_0_16px_var(--glow)] focus-within:border-primary/40`.
  - **Big rate:** `text-3xl font-bold tabular-nums text-accent-foreground`.
  - **Bars:** `<WeeklyBars weeks={weeks} className="w-[55%]" />`.
  - **"+ Meta da semana":** a `Link` styled with `buttonVariants({ variant: 'secondary', size: 'sm' })`, right-aligned.
  - **`CompletedObjectiveCard`:**
    - "✓ Concluído em {formatDate(completedAt)}" plus ` · {describeSchedule(...)}` when non-null, in `text-sm font-medium text-accent-foreground`.
    - `{weeksFulfilled} semana(s) cumprida(s) · {tasksCompleted} tarefa(s)` in muted text.
    - The menu.
  - **Overview:** `grid grid-cols-3 gap-3`. Each tile is `rounded-lg border border-border bg-card p-3`, the number is `text-xl md:text-2xl font-bold tabular-nums text-accent-foreground`, and the label is `text-xs text-muted-foreground`.

- [ ] **Step 4: Run the tests to verify they pass,** then run lint.

- [ ] **Step 5: Commit.**

---

### Task 5: Page wiring, empty states, deep link

**Files:**
- Modify: `src/app/objectives/page.tsx`
- Modify: `src/app/objectives/[id]/page.tsx`
- Modify: `src/components/weekly-goals-panel.tsx`
- Modify: `src/components/add-weekly-goal-card.tsx` and its test
- Modify: `src/components/weekly-goal-form.tsx`

**Interfaces:**
- Consumes: everything above, plus `listObjectivesWithStats` and `deleteObjective`.
- Produces:
  - `AddWeeklyGoalCard({ onCreate, defaultOpen?: boolean })`
  - `WeeklyGoalsPanel({ …existing, openNewGoal?: boolean })`
  - `WeeklyGoalForm({ …existing, autoFocusTitle?: boolean })`

- [ ] **Step 1: Write the failing tests.**
  - **`add-weekly-goal-card.test.tsx`:** `render(<AddWeeklyGoalCard onCreate={vi.fn()} defaultOpen />)`. The title input (`getByLabelText('Título')`) is in the document and focused, and there is no "+ Nova meta semanal" button.
  - **`weekly-goals-panel.test.tsx`:** with `openNewGoal`, the form is open and the wrapper has `id="nova-meta"`.

- [ ] **Step 2: Implement the deep link.**
  - **`AddWeeklyGoalCard`:** `useState(defaultOpen ?? false)`, and passes `autoFocusTitle={defaultOpen}` to `WeeklyGoalForm`.
  - **`WeeklyGoalForm`:** adds `autoFocus={autoFocusTitle}` on the title `Input`.
  - **`WeeklyGoalsPanel`:** wraps `AddWeeklyGoalCard` in `<div id="nova-meta" className="scroll-mt-20">` and forwards `defaultOpen={openNewGoal}`.
  - **`/objectives/[id]/page.tsx`:** read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` for `searchParams`. Add `searchParams: Promise<{ [key: string]: string | string[] | undefined }>` to the props and `const { 'nova-meta': novaMeta } = await searchParams`, then pass `openNewGoal={novaMeta === '1'}`.

- [ ] **Step 3: Rewrite `src/app/objectives/page.tsx`:**

```tsx
// keep: metadata, imports of Link, Button, deleteObjective, listObjectivesWithStats
export default async function ObjectivesPage() {
  const { active, completed } = await listObjectivesWithStats()
  const now = new Date()
  const totals = overview(active, now)
  const hasAny = active.length + completed.length > 0
  // … title row unchanged (h1 + "Novo objetivo")
  // !hasAny → empty block: "Você ainda não tem objetivos." + Link button "Criar meu primeiro objetivo" → /objectives/new
  // hasAny → <ObjectivesOverview {...totals} />, then
  //   active.length === 0 → "Nenhum objetivo em andamento. Que tal começar o próximo?"
  //   else <div className="grid gap-4 md:grid-cols-2"> active.map(o => <ObjectiveDashboardCard key id title startDate
  //        weeks={calendarWeeks(o.stats.recentWeeks, now)} streak={streak(o.stats.recentWeeks, now)}
  //        timeline={timeline(o.startDate, o.targetDate, now)} onDelete={deleteObjective.bind(null, o.id)} />)
  //   completed.length > 0 → existing "Concluídos" h2 + same grid of <CompletedObjectiveCard … />
}
```

Use `<main className="mx-auto max-w-5xl p-4 md:p-8">`. Remove `ObjectiveRow` and the now-unused imports (`Card*`, `DeleteButton`, `ObjectiveStatsPanel`, `describeSchedule` if it moved into `CompletedObjectiveCard`).

- [ ] **Step 4: Run the full suite, lint and tsc.** Run `npm test`, `npm run lint` and `npx tsc --noEmit 2>&1 | grep -v "\.test\.ts"`. Expected: green, with no new errors.

- [ ] **Step 5: Commit.**

---

### Task 6: Verify and merge

- [ ] **Step 1: Build in a separate checkout.** Use `git worktree add <scratchpad>/wt-objetivos feature/objetivos-painel`, then inside it `npm ci` (or copy `.env`, which `npm ci` needs for `prisma generate`, from the main folder), then `npx next build`, then `npx next start -p 3100`. Never build in the main folder.
- [ ] **Step 2: Check in the browser** at `http://localhost:3100/objectives`, in both themes:
  - the overview tiles;
  - two columns on desktop and one at 375px (`scrollWidth === 375`);
  - hover tooltips on the bars and focus tooltips via Tab;
  - the streak chip and "sem meta nesta semana";
  - both timeline captions;
  - the "⋯" menu: Editar navigates, and Excluir… opens the dialog (cancel it, deleting nothing);
  - "+ Meta da semana" opens the objective with the form open and focused;
  - the completed section.
- [ ] **Step 3: Clean up.** Stop the 3100 server and kill its node process. Remove the worktree with `git worktree remove`.
- [ ] **Step 4: Merge into develop.** Run `git checkout develop` and `git merge --no-ff feature/objetivos-painel -F <file>`, with a detailed message and the exact trailer. Then `git branch -d feature/objetivos-painel`. Do not push or touch `master` without the user's go-ahead.
