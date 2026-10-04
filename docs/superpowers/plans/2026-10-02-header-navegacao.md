# Header and Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the icon rail with a sticky top header. The header carries labeled tabs, a quick-search dialog (Ctrl/⌘+K), today's progress summary and the theme toggle. Internal pages get breadcrumbs, and mobile gets a labeled bottom bar.

**Architecture:** Two new Server Actions supply data: `getTodaySummary`, which only runs counts, and `search`, a case-insensitive Prisma `contains` query. Pure types and constants live in `src/lib/search.ts`, so client code never imports a `'use server'` module for values. `AppHeader` is a Server Component that loads the summary and passes the `search` and `setTheme` actions down as props, the existing pattern. Each internal page renders its own `Breadcrumbs`, because only the page has the titles.

**Tech Stack:** Next.js 16 App Router (read `node_modules/next/dist/docs/` before touching Next APIs, per AGENTS.md), React 19, Tailwind CSS 4, Base UI Dialog (`src/components/ui/dialog.tsx`), Prisma + Postgres, Vitest + Testing Library + user-event.

**Spec:** `docs/superpowers/specs/2026-10-02-header-navegacao-design.md`

## Global Constraints

- Work on branch `feature/header-navegacao` (cut from `develop`). Merge back into `develop` with `--no-ff`. Never commit to `develop` or `master` directly.
- Every commit message is detailed: what changed, which files/areas are impacted, the behavior change and the test status. The last line is exactly `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. On Windows git, write the message to a file and use `git commit -F <file>`, because `-F -` fails.
- No new dependencies.
- UI copy is Brazilian Portuguese, exactly as written in this plan.
- No 6-digit or 8-digit hex color literals in `src/**/*.tsx?`; `src/lib/theme-contrast.test.ts` enforces this. Use theme tokens. For small text in the primary color use `text-accent-foreground`, never `text-primary`, so light mode keeps WCAG AA.
- Client components import from `@/lib/theme` only with `import type`, because that module imports `next/headers`. They import nothing as values from `@/lib/actions/*`; actions arrive as props.
- Search: trim the query, cap it at 100 characters, require at least 2 characters, return at most 5 objectives and 5 weekly goals, ignore case but not accents.
- Run the whole suite with `npm test`; it needs the Docker Postgres. Four test files already have TypeScript fixture errors about a missing `completedAt`. They are not this plan's to fix.
- Do not start or stop dev servers.

## Review Focus

1. **A slow early search response landing after a newer one**, for example "co" resolving after "cor". The dialog must keep the newer results. This is pinned in Task 6.
2. **Deleting back below 2 characters while a search is in flight.** The dialog must show the hint, not the late results. This is pinned in Task 6, because results render only when their query equals the current trimmed query.
3. **Long titles in breadcrumbs and search results** must truncate without horizontal scroll at 375px. Task 4 asserts the `title` attribute and the truncate classes. The scroll itself is checked manually in Task 8.
4. **The header summary staying stale after toggling a task.** It must update on the same screen. This is checked manually in Task 8, with a fallback fix written into that task.
5. **Ctrl+K while focus is in a form field** must still open search and must not type a "k". `preventDefault` handles both. This is pinned in Task 6.

---

### Task 1: Shared active-link rule and search types

**Files:**
- Create: `src/lib/navigation.ts`, `src/lib/navigation.test.ts`
- Create: `src/lib/search.ts`

**Interfaces:**
- Produces:
  - `isLinkActive(pathname: string, href: string): boolean`
  - `NAV_LINKS: ReadonlyArray<{ href: '/' | '/objectives'; label: 'Hoje' | 'Objetivos' }>`
  - `MIN_QUERY_LENGTH = 2`
  - `MAX_QUERY_LENGTH = 100`
  - `MAX_RESULTS_PER_GROUP = 5`
  - `type ObjectiveHit = { id: string; title: string; completed: boolean }`
  - `type WeeklyGoalHit = { id: string; title: string; objectiveId: string; objectiveTitle: string; weekStart: Date }`
  - `type SearchResults = { objectives: ObjectiveHit[]; weeklyGoals: WeeklyGoalHit[] }`
  - `EMPTY_RESULTS: SearchResults`
  - `normalizeQuery(raw: string): string | null`: returns the trimmed string capped at 100 characters, or `null` when it has fewer than 2 characters.

- [ ] **Step 1: Write the failing tests** in `src/lib/navigation.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isLinkActive, NAV_LINKS } from '@/lib/navigation'
import { normalizeQuery } from '@/lib/search'

describe('isLinkActive', () => {
  it('treats Hoje as active only on the root', () => {
    expect(isLinkActive('/', '/')).toBe(true)
    expect(isLinkActive('/objectives', '/')).toBe(false)
  })

  it('treats Objetivos as active on it and nested routes', () => {
    expect(isLinkActive('/objectives', '/objectives')).toBe(true)
    expect(isLinkActive('/objectives/123/weeks/456', '/objectives')).toBe(true)
  })

  it('respects path boundaries', () => {
    expect(isLinkActive('/objectives-archive', '/objectives')).toBe(false)
  })

  it('lists the two destinations in order', () => {
    expect(NAV_LINKS.map((l) => l.label)).toEqual(['Hoje', 'Objetivos'])
  })
})

describe('normalizeQuery', () => {
  it('rejects queries shorter than 2 characters after trimming', () => {
    expect(normalizeQuery('')).toBeNull()
    expect(normalizeQuery('  a  ')).toBeNull()
  })

  it('trims and caps at 100 characters', () => {
    expect(normalizeQuery('  corrida ')).toBe('corrida')
    expect(normalizeQuery('x'.repeat(150))).toHaveLength(100)
  })
})
```

- [ ] **Step 2: Run it to verify it fails.** Run `npx vitest run src/lib/navigation.test.ts`. Expected: FAIL, the modules don't exist.

- [ ] **Step 3: Implement `src/lib/navigation.ts`:**

```ts
export const NAV_LINKS = [
  { href: '/', label: 'Hoje' },
  { href: '/objectives', label: 'Objetivos' },
] as const

export function isLinkActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}
```

- [ ] **Step 4: Implement `src/lib/search.ts`.** These are pure types and constants, safe for client imports.

```ts
export const MIN_QUERY_LENGTH = 2
export const MAX_QUERY_LENGTH = 100
export const MAX_RESULTS_PER_GROUP = 5

export type ObjectiveHit = { id: string; title: string; completed: boolean }
export type WeeklyGoalHit = {
  id: string
  title: string
  objectiveId: string
  objectiveTitle: string
  weekStart: Date
}
export type SearchResults = { objectives: ObjectiveHit[]; weeklyGoals: WeeklyGoalHit[] }

export const EMPTY_RESULTS: SearchResults = { objectives: [], weeklyGoals: [] }

export function normalizeQuery(raw: string): string | null {
  const trimmed = raw.trim().slice(0, MAX_QUERY_LENGTH)
  return trimmed.length >= MIN_QUERY_LENGTH ? trimmed : null
}
```

- [ ] **Step 5: Run it to verify it passes.** Run `npx vitest run src/lib/navigation.test.ts`. Expected: 6 passed.

- [ ] **Step 6: Commit** with a detailed message. Name both new modules, say nothing uses them yet, and give the test count.

---

### Task 2: `getTodaySummary` action

**Files:**
- Create: `src/lib/actions/summary.ts`, `src/lib/actions/summary.test.ts`

**Interfaces:**
- Produces:
  - `type TodaySummary = { completed: number; total: number; weekStart: Date }`, exported from `src/lib/actions/summary.ts` as a type
  - `async function getTodaySummary(now?: Date): Promise<TodaySummary>`

- [ ] **Step 1: Write the failing test** in `src/lib/actions/summary.test.ts`. It uses the real test DB; `src/test/setup.ts` truncates tables after each test.

```ts
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { getTodaySummary } from '@/lib/actions/summary'
import { getWeekBounds } from '@/lib/dates'

async function goal() {
  const objective = await prisma.objective.create({ data: { title: 'Obj', startDate: new Date('2026-09-01') } })
  return prisma.weeklyGoal.create({
    data: { title: 'Meta', objectiveId: objective.id, ...getWeekBounds(new Date('2026-10-01T12:00:00')) },
  })
}

describe('getTodaySummary', () => {
  const now = new Date('2026-10-01T15:00:00')

  it("counts only today's tasks and how many are done", async () => {
    const g = await goal()
    await prisma.dailyTask.createMany({
      data: [
        { title: 'a', weeklyGoalId: g.id, date: new Date('2026-10-01T09:00:00'), completed: true },
        { title: 'b', weeklyGoalId: g.id, date: new Date('2026-10-01T18:00:00'), completed: false },
        { title: 'c', weeklyGoalId: g.id, date: new Date('2026-10-02T09:00:00'), completed: true },
      ],
    })

    const summary = await getTodaySummary(now)

    expect(summary.total).toBe(2)
    expect(summary.completed).toBe(1)
  })

  it('reports an empty day as zero of zero', async () => {
    expect(await getTodaySummary(now)).toMatchObject({ completed: 0, total: 0 })
  })

  it('returns the Monday of the current week', async () => {
    const { weekStart } = await getTodaySummary(now)
    expect(weekStart.getDay()).toBe(1)
    expect(weekStart.getDate()).toBe(28)
  })
})
```

- [ ] **Step 2: Run it to verify it fails.** Run `npx vitest run src/lib/actions/summary.test.ts`. Expected: FAIL, the module doesn't exist.

- [ ] **Step 3: Implement `src/lib/actions/summary.ts`:**

```ts
'use server'

import { endOfDay, startOfDay } from 'date-fns'
import { prisma } from '@/lib/db'
import { getWeekBounds } from '@/lib/dates'

export type TodaySummary = { completed: number; total: number; weekStart: Date }

// Two counts rather than loading the tasks: the header renders on every page
// and only needs the numbers. Same day bounds as listDailyTasksByDate.
export async function getTodaySummary(now: Date = new Date()): Promise<TodaySummary> {
  const date = { gte: startOfDay(now), lte: endOfDay(now) }
  const [total, completed] = await Promise.all([
    prisma.dailyTask.count({ where: { date } }),
    prisma.dailyTask.count({ where: { date, completed: true } }),
  ])
  return { completed, total, weekStart: getWeekBounds(now).weekStart }
}
```

A `'use server'` file may only export async functions. If the type export trips the build or lint, move `TodaySummary` to `src/lib/search.ts`'s sibling `src/lib/summary.ts` (types only) and import it from there.

- [ ] **Step 4: Run it to verify it passes.** Expected: 3 passed.

- [ ] **Step 5: Commit** with a detailed message.

---

### Task 3: `search` action

**Files:**
- Create: `src/lib/actions/search.ts`, `src/lib/actions/search.test.ts`

**Interfaces:**
- Consumes: `normalizeQuery`, `MAX_RESULTS_PER_GROUP`, `EMPTY_RESULTS` and `SearchResults` from `@/lib/search` (Task 1).
- Produces: `async function search(query: string): Promise<SearchResults>`.

- [ ] **Step 1: Write the failing test** in `src/lib/actions/search.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { search } from '@/lib/actions/search'
import { getWeekBounds } from '@/lib/dates'

async function objective(title: string, completed = false) {
  return prisma.objective.create({
    data: {
      title,
      startDate: new Date('2026-01-01'),
      status: completed ? 'COMPLETED' : 'ACTIVE',
      completedAt: completed ? new Date('2026-06-01') : null,
    },
  })
}

async function weeklyGoal(title: string, objectiveId: string, day: string) {
  return prisma.weeklyGoal.create({
    data: { title, objectiveId, ...getWeekBounds(new Date(`${day}T12:00:00`)) },
  })
}

describe('search', () => {
  it('matches objective and weekly goal titles ignoring case', async () => {
    const obj = await objective('Correr uma maratona')
    await weeklyGoal('Corrida longa', obj.id, '2026-09-30')
    await objective('Ler 12 livros')

    const results = await search('CORR')

    expect(results.objectives.map((o) => o.title)).toEqual(['Correr uma maratona'])
    expect(results.weeklyGoals).toEqual([
      expect.objectContaining({ title: 'Corrida longa', objectiveId: obj.id, objectiveTitle: 'Correr uma maratona' }),
    ])
  })

  it('returns nothing for queries under 2 characters, without hitting the database', async () => {
    await objective('A meta')
    expect(await search(' a ')).toEqual({ objectives: [], weeklyGoals: [] })
  })

  it('caps each group at 5 results', async () => {
    const obj = await objective('Base 0')
    for (let i = 1; i <= 6; i++) await objective(`Base ${i}`)
    for (let i = 0; i < 6; i++) await weeklyGoal(`Base meta ${i}`, obj.id, `2026-0${i + 1}-15`)

    const results = await search('base')

    expect(results.objectives).toHaveLength(5)
    expect(results.weeklyGoals).toHaveLength(5)
  })

  it('lists active objectives before completed ones, then by title', async () => {
    await objective('Treino B', true)
    await objective('Treino C')
    await objective('Treino A')

    const results = await search('treino')

    expect(results.objectives.map((o) => [o.title, o.completed])).toEqual([
      ['Treino A', false],
      ['Treino C', false],
      ['Treino B', true],
    ])
  })

  it('lists weekly goals newest week first', async () => {
    const obj = await objective('Obj')
    await weeklyGoal('Leitura antiga', obj.id, '2026-03-04')
    await weeklyGoal('Leitura nova', obj.id, '2026-09-30')

    const results = await search('leitura')

    expect(results.weeklyGoals.map((g) => g.title)).toEqual(['Leitura nova', 'Leitura antiga'])
  })
})
```

- [ ] **Step 2: Run it to verify it fails.** Run `npx vitest run src/lib/actions/search.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/actions/search.ts`:**

```ts
'use server'

import { prisma } from '@/lib/db'
import { EMPTY_RESULTS, MAX_RESULTS_PER_GROUP, normalizeQuery, type SearchResults } from '@/lib/search'

// Server Actions are public endpoints: the query is re-normalised here, and
// only ever reaches Postgres as a bound parameter through Prisma.
export async function search(query: string): Promise<SearchResults> {
  const q = normalizeQuery(typeof query === 'string' ? query : '')
  if (!q) return EMPTY_RESULTS

  const title = { contains: q, mode: 'insensitive' as const }
  const [objectives, weeklyGoals] = await Promise.all([
    prisma.objective.findMany({
      where: { title },
      // 'ACTIVE' sorts before 'COMPLETED' alphabetically.
      orderBy: [{ status: 'asc' }, { title: 'asc' }],
      take: MAX_RESULTS_PER_GROUP,
      select: { id: true, title: true, status: true },
    }),
    prisma.weeklyGoal.findMany({
      where: { title },
      orderBy: { weekStart: 'desc' },
      take: MAX_RESULTS_PER_GROUP,
      select: { id: true, title: true, objectiveId: true, weekStart: true, objective: { select: { title: true } } },
    }),
  ])

  return {
    objectives: objectives.map((o) => ({ id: o.id, title: o.title, completed: o.status === 'COMPLETED' })),
    weeklyGoals: weeklyGoals.map((g) => ({
      id: g.id,
      title: g.title,
      objectiveId: g.objectiveId,
      objectiveTitle: g.objective.title,
      weekStart: g.weekStart,
    })),
  }
}
```

Check `prisma/schema.prisma`'s `Status` enum order. If Prisma orders enums by declaration rather than alphabetically, `status: 'asc'` still works only when `ACTIVE` is declared first. Confirm it, and if it isn't, sort in JavaScript after the query instead (fetch with `take` applied per status, or sort and slice).

- [ ] **Step 4: Run it to verify it passes.** Expected: 5 passed.

- [ ] **Step 5: Commit** with a detailed message.

---

### Task 4: `DaySummary` and `Breadcrumbs` components

**Files:**
- Create: `src/components/day-summary.tsx`, `src/components/day-summary.test.tsx`
- Create: `src/components/breadcrumbs.tsx`, `src/components/breadcrumbs.test.tsx`

**Interfaces:**
- Consumes: `formatDayMonth` from `@/lib/dates`.
- Produces:
  - `DaySummary(props: { completed: number; total: number; weekStart: Date })`
  - `Breadcrumbs(props: { items: Array<{ label: string; href?: string }> })`

- [ ] **Step 1: Write the failing tests.**

`src/components/day-summary.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DaySummary } from '@/components/day-summary'

const weekStart = new Date(2026, 8, 28)

describe('DaySummary', () => {
  it("shows today's progress and the week, linking to Hoje", () => {
    render(<DaySummary completed={3} total={5} weekStart={weekStart} />)

    const link = screen.getByRole('link', { name: '3 de 5 tarefas de hoje concluídas, semana de 28/09' })
    expect(link).toHaveAttribute('href', '/')
    expect(screen.getByText('3 de 5 hoje')).toBeInTheDocument()
    expect(screen.getByText('3/5')).toBeInTheDocument()
    expect(screen.getByText(/semana de 28\/09/)).toBeInTheDocument()
  })

  it('says there is nothing today when the day is empty', () => {
    render(<DaySummary completed={0} total={0} weekStart={weekStart} />)

    expect(screen.getByRole('link', { name: 'Nenhuma tarefa hoje, semana de 28/09' })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma tarefa hoje')).toBeInTheDocument()
    expect(screen.queryByTestId('summary-ring')).not.toBeInTheDocument()
  })

  it('glows the ring when every task is done', () => {
    render(<DaySummary completed={2} total={2} weekStart={weekStart} />)
    expect(screen.getByTestId('summary-ring')).toHaveAttribute('data-complete', 'true')
  })
})
```

`src/components/breadcrumbs.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Breadcrumbs } from '@/components/breadcrumbs'

describe('Breadcrumbs', () => {
  const items = [
    { label: 'Objetivos', href: '/objectives' },
    { label: 'Correr uma maratona', href: '/objectives/1' },
    { label: 'Correr 3 vezes', href: '/objectives/1/weeks/2' },
  ]

  it('links every item except the current page', () => {
    render(<Breadcrumbs items={items} />)

    const nav = screen.getByRole('navigation', { name: 'Trilha' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Objetivos' })).toHaveAttribute('href', '/objectives')
    expect(screen.getByRole('link', { name: 'Correr uma maratona' })).toHaveAttribute('href', '/objectives/1')
    expect(screen.queryByRole('link', { name: 'Correr 3 vezes' })).not.toBeInTheDocument()
    expect(screen.getByText('Correr 3 vezes')).toHaveAttribute('aria-current', 'page')
  })

  it('keeps the full name available when a label is truncated', () => {
    render(<Breadcrumbs items={items} />)
    const current = screen.getByText('Correr 3 vezes')
    expect(current).toHaveAttribute('title', 'Correr 3 vezes')
    expect(current).toHaveClass('truncate')
  })
})
```

- [ ] **Step 2: Run them to verify they fail.** Run `npx vitest run src/components/day-summary.test.tsx src/components/breadcrumbs.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement `src/components/day-summary.tsx`:**

```tsx
import Link from 'next/link'
import { formatDayMonth } from '@/lib/dates'
import { cn } from '@/lib/utils'

const R = 8
const C = 2 * Math.PI * R

export function DaySummary({ completed, total, weekStart }: { completed: number; total: number; weekStart: Date }) {
  const week = `semana de ${formatDayMonth(weekStart)}`
  const empty = total === 0
  const done = !empty && completed === total
  const label = empty ? `Nenhuma tarefa hoje, ${week}` : `${completed} de ${total} tarefas de hoje concluídas, ${week}`

  return (
    <Link
      href="/"
      aria-label={label}
      className="flex items-center gap-2 rounded-md px-2 py-1 text-sm tabular-nums text-muted-foreground transition-colors hover:text-foreground"
    >
      {!empty && (
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          aria-hidden="true"
          data-testid="summary-ring"
          data-complete={done}
          className={cn('-rotate-90 overflow-visible', done && 'drop-shadow-[0_0_4px_var(--primary)]')}
        >
          <circle cx="10" cy="10" r={R} fill="none" stroke="var(--muted)" strokeWidth="3" />
          <circle
            cx="10"
            cy="10"
            r={R}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C - (completed / total) * C}
          />
        </svg>
      )}
      <span aria-hidden="true" className="md:hidden">
        {empty ? '0' : `${completed}/${total}`}
      </span>
      <span aria-hidden="true" className="hidden md:inline">
        <span className="text-foreground">{empty ? 'Nenhuma tarefa hoje' : `${completed} de ${total} hoje`}</span>
        {` · ${week}`}
      </span>
    </Link>
  )
}
```

- [ ] **Step 4: Implement `src/components/breadcrumbs.tsx`:**

```tsx
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Trilha" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${index}-${item.label}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
              {isLast || !item.href ? (
                <span
                  title={item.label}
                  aria-current={isLast ? 'page' : undefined}
                  className="max-w-[16rem] truncate font-medium text-foreground"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  title={item.label}
                  className="max-w-[16rem] truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
```

- [ ] **Step 5: Run them to verify they pass.** Expected: 5 passed.

- [ ] **Step 6: Commit** with a detailed message.

---

### Task 5: `HeaderNav` and `BottomNav`

**Files:**
- Create: `src/components/header-nav.tsx`, `src/components/header-nav.test.tsx`
- Create: `src/components/bottom-nav.tsx`, `src/components/bottom-nav.test.tsx`

**Interfaces:**
- Consumes: `NAV_LINKS` and `isLinkActive` (Task 1).
- Produces: `HeaderNav()` and `BottomNav()`. Both are client components with no props.

- [ ] **Step 1: Write the failing tests.**

`src/components/header-nav.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { HeaderNav } from '@/components/header-nav'

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }))

describe('HeaderNav', () => {
  it.each([
    ['/', 'Hoje'],
    ['/objectives', 'Objetivos'],
    ['/objectives/1/weeks/2', 'Objetivos'],
  ])('on %s marks %s as the current page', (path, active) => {
    vi.mocked(usePathname).mockReturnValue(path)
    render(<HeaderNav />)

    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: active })).toHaveAttribute('aria-current', 'page')
    const other = active === 'Hoje' ? 'Objetivos' : 'Hoje'
    expect(screen.getByRole('link', { name: other })).not.toHaveAttribute('aria-current')
  })
})
```

`src/components/bottom-nav.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { BottomNav } from '@/components/bottom-nav'

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }))

describe('BottomNav', () => {
  it('shows both destinations with visible labels and marks the active one', () => {
    vi.mocked(usePathname).mockReturnValue('/objectives/9')
    render(<BottomNav />)

    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByText('Hoje')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Hoje' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Objetivos' })).toHaveAttribute('aria-current', 'page')
  })
})
```

- [ ] **Step 2: Run them to verify they fail.**

- [ ] **Step 3: Implement `src/components/header-nav.tsx`:**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isLinkActive, NAV_LINKS } from '@/lib/navigation'
import { cn } from '@/lib/utils'

export function HeaderNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Navegação principal" className="hidden items-center gap-1 md:flex">
      {NAV_LINKS.map(({ href, label }) => {
        const active = isLinkActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 4: Implement `src/components/bottom-nav.tsx`:**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck, Target } from 'lucide-react'
import { isLinkActive, NAV_LINKS } from '@/lib/navigation'
import { cn } from '@/lib/utils'

const ICONS = { '/': CalendarCheck, '/objectives': Target } as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-50 flex h-14 items-stretch justify-around border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {NAV_LINKS.map(({ href, label }) => {
        const active = isLinkActive(pathname, href)
        const Icon = ICONS[href]
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-w-16 flex-col items-center justify-center gap-0.5 px-4 text-xs font-medium transition-colors',
              active ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground',
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 5: Run them to verify they pass.** Expected: 4 passed.

- [ ] **Step 6: Commit** with a detailed message.

---

### Task 6: `SearchDialog`

**Files:**
- Create: `src/components/search-dialog.tsx`, `src/components/search-dialog.test.tsx`

**Interfaces:**
- Consumes: `SearchResults`, `normalizeQuery` and `MIN_QUERY_LENGTH` from `@/lib/search`; `formatDayMonth`; `Dialog`, `DialogContent` and `DialogTitle` from `@/components/ui/dialog`.
- Produces: `SearchDialog(props: { onSearch: (query: string) => Promise<SearchResults> })`. It renders its own two trigger buttons, a desktop one and a mobile one.

- [ ] **Step 1: Read the existing dialog wrapper.** Read `src/components/ui/dialog.tsx` (Base UI Dialog: `open` / `onOpenChange` on the root, `DialogContent` takes `showCloseButton` and `className`). Also read `src/components/delete-button.test.tsx` to see how dialogs are tested in this repo.

- [ ] **Step 2: Write the failing tests** in `src/components/search-dialog.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchDialog } from '@/components/search-dialog'
import type { SearchResults } from '@/lib/search'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const results: SearchResults = {
  objectives: [{ id: 'o1', title: 'Correr uma maratona', completed: false }],
  weeklyGoals: [
    { id: 'w1', title: 'Corrida longa', objectiveId: 'o1', objectiveTitle: 'Correr uma maratona', weekStart: new Date(2026, 8, 28) },
  ],
}

afterEach(() => push.mockClear())

async function openWithShortcut() {
  await userEvent.keyboard('{Control>}k{/Control}')
  return screen.findByRole('combobox')
}

describe('SearchDialog', () => {
  it('opens with Ctrl+K and closes again with Ctrl+K', async () => {
    render(<SearchDialog onSearch={vi.fn()} />)

    await openWithShortcut()
    await userEvent.keyboard('{Control>}k{/Control}')

    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument())
  })

  it('opens from a trigger button', async () => {
    render(<SearchDialog onSearch={vi.fn()} />)
    await userEvent.click(screen.getAllByRole('button', { name: /buscar/i })[0])
    expect(await screen.findByRole('combobox')).toHaveFocus()
  })

  it('does not type a "k" into a focused field when the shortcut is used', async () => {
    render(
      <>
        <input aria-label="campo" />
        <SearchDialog onSearch={vi.fn()} />
      </>,
    )
    await userEvent.click(screen.getByLabelText('campo'))
    await userEvent.keyboard('{Control>}k{/Control}')
    expect(screen.getByLabelText('campo')).toHaveValue('')
    expect(await screen.findByRole('combobox')).toBeInTheDocument()
  })

  it('asks for at least 2 letters before searching', async () => {
    const onSearch = vi.fn()
    render(<SearchDialog onSearch={onSearch} />)
    const input = await openWithShortcut()

    await userEvent.type(input, 'c')

    expect(screen.getByText('Digite pelo menos 2 letras')).toBeInTheDocument()
    expect(onSearch).not.toHaveBeenCalled()
  })

  it('searches once after typing stops and shows both groups', async () => {
    const onSearch = vi.fn().mockResolvedValue(results)
    render(<SearchDialog onSearch={onSearch} />)
    const input = await openWithShortcut()

    await userEvent.type(input, 'corr')

    expect(await screen.findByRole('option', { name: /Correr uma maratona/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Corrida longa/ })).toHaveTextContent('Correr uma maratona · semana de 28/09')
    expect(screen.getByText('Objetivos')).toBeInTheDocument()
    expect(screen.getByText('Metas da semana')).toBeInTheDocument()
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('corr')
  })

  it('says when nothing matches', async () => {
    render(<SearchDialog onSearch={vi.fn().mockResolvedValue({ objectives: [], weeklyGoals: [] })} />)
    const input = await openWithShortcut()

    await userEvent.type(input, 'xyz')

    expect(await screen.findByText('Nada encontrado para “xyz”')).toBeInTheDocument()
  })

  it('opens the highlighted result with the keyboard and closes', async () => {
    render(<SearchDialog onSearch={vi.fn().mockResolvedValue(results)} />)
    const input = await openWithShortcut()
    await userEvent.type(input, 'corr')
    await screen.findByRole('option', { name: /Corrida longa/ })

    await userEvent.keyboard('{ArrowDown}{Enter}')

    expect(push).toHaveBeenCalledWith('/objectives/o1/weeks/w1')
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument())
  })

  it('ignores a slow earlier response that arrives after a newer one', async () => {
    let resolveEarly!: (r: SearchResults) => void
    const onSearch = vi.fn((q: string) =>
      q === 'co'
        ? new Promise<SearchResults>((resolve) => (resolveEarly = resolve))
        : Promise.resolve(results),
    )
    render(<SearchDialog onSearch={onSearch} />)
    const input = await openWithShortcut()

    await userEvent.type(input, 'co')
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('co'))
    await userEvent.type(input, 'r')
    await screen.findByRole('option', { name: /Correr uma maratona/ })

    resolveEarly({ objectives: [{ id: 'old', title: 'Coisa velha', completed: false }], weeklyGoals: [] })

    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('Coisa velha')).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Correr uma maratona/ })).toBeInTheDocument()
  })

  it('shows an error message when the search fails', async () => {
    render(<SearchDialog onSearch={vi.fn().mockRejectedValue(new Error('down'))} />)
    const input = await openWithShortcut()

    await userEvent.type(input, 'corr')

    expect(await screen.findByText('Não foi possível buscar agora.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run it to verify it fails.** Run `npx vitest run src/components/search-dialog.test.tsx`. Expected: FAIL.

- [ ] **Step 4: Implement `src/components/search-dialog.tsx`.** The rendered state is derived from the query; `setState` happens only inside the debounced callback and event handlers. This keeps the React Compiler lint rules quiet and makes late responses harmless.

```tsx
'use client'

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { formatDayMonth } from '@/lib/dates'
import { normalizeQuery, type SearchResults } from '@/lib/search'
import { cn } from '@/lib/utils'

type Option = { key: string; href: string; title: string; detail?: string; completed?: boolean }
type Response = { query: string; results?: SearchResults; failed?: boolean }

const DEBOUNCE_MS = 150

function toOptions(results: SearchResults) {
  const objectives: Option[] = results.objectives.map((o) => ({
    key: `o-${o.id}`,
    href: `/objectives/${o.id}`,
    title: o.title,
    completed: o.completed,
  }))
  const weeklyGoals: Option[] = results.weeklyGoals.map((g) => ({
    key: `w-${g.id}`,
    href: `/objectives/${g.objectiveId}/weeks/${g.id}`,
    title: g.title,
    detail: `${g.objectiveTitle} · semana de ${formatDayMonth(g.weekStart)}`,
  }))
  return { objectives, weeklyGoals, all: [...objectives, ...weeklyGoals] }
}

const subscribeNoop = () => () => {}
function useIsMac() {
  return useSyncExternalStore(
    subscribeNoop,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  )
}

export function SearchDialog({ onSearch }: { onSearch: (query: string) => Promise<SearchResults> }) {
  const router = useRouter()
  const isMac = useIsMac()
  const listboxId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState<Response | null>(null)
  const [active, setActive] = useState(0)
  const latest = useRef(0)

  const normalized = normalizeQuery(query)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const id = ++latest.current
    if (!normalized) return
    const timer = setTimeout(async () => {
      try {
        const results = await onSearch(normalized)
        if (id === latest.current) {
          setResponse({ query: normalized, results })
          setActive(0)
        }
      } catch {
        if (id === latest.current) setResponse({ query: normalized, failed: true })
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [normalized, onSearch])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResponse(null)
    setActive(0)
  }, [])

  // Only a response for exactly what is typed now is ever shown.
  const current = normalized && response?.query === normalized ? response : null
  const groups = current?.results ? toOptions(current.results) : null
  const options = groups?.all ?? []

  function go(option: Option) {
    router.push(option.href)
    close()
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (options.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => (i + 1) % options.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (i - 1 + options.length) % options.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      go(options[active])
    }
  }

  const status = !normalized
    ? 'Digite pelo menos 2 letras'
    : current?.failed
      ? 'Não foi possível buscar agora.'
      : groups && options.length === 0
        ? `Nada encontrado para “${normalized}”`
        : groups
          ? `${options.length} ${options.length === 1 ? 'resultado' : 'resultados'}`
          : ''

  function renderGroup(title: string, items: Option[]) {
    if (items.length === 0) return null
    return (
      <div role="group" aria-label={title}>
        <p className="px-2 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground" aria-hidden="true">
          {title}
        </p>
        {items.map((option) => {
          const index = options.indexOf(option)
          return (
            <div
              key={option.key}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => go(option)}
              className={cn(
                'flex cursor-pointer flex-col rounded-md px-2 py-1.5',
                index === active && 'bg-accent text-accent-foreground',
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{option.title}</span>
                {option.completed && (
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                    concluído
                  </span>
                )}
              </span>
              {option.detail && <span className="truncate text-xs text-muted-foreground">{option.detail}</span>}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-8 w-56 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:flex"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="rounded border border-border px-1.5 text-[11px]">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <button
        type="button"
        aria-label="Buscar"
        onClick={() => setOpen(true)}
        className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground md:hidden"
      >
        <Search className="size-5" />
      </button>

      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent className="top-[20%] translate-y-0 gap-2 sm:max-w-lg" showCloseButton={false}>
          <DialogTitle className="sr-only">Buscar</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              role="combobox"
              aria-expanded={options.length > 0}
              aria-controls={listboxId}
              aria-activedescendant={options.length > 0 ? `${listboxId}-${active}` : undefined}
              aria-label="Buscar objetivos e metas"
              autoComplete="off"
              placeholder="Buscar objetivos e metas…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              className="h-9 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
            />
          </div>
          <div id={listboxId} role="listbox" aria-label="Resultados" className="max-h-80 overflow-y-auto">
            {groups && renderGroup('Objetivos', groups.objectives)}
            {groups && renderGroup('Metas da semana', groups.weeklyGoals)}
          </div>
          <p aria-live="polite" className={cn('px-2 text-sm text-muted-foreground', options.length > 0 && 'sr-only')}>
            {status}
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

If `npm run lint` flags `autoFocus` (jsx-a11y), keep it with an inline disable comment explaining that this is the dialog's single primary input. The guidelines allow autofocus there.

- [ ] **Step 5: Run it to verify it passes.** Run `npx vitest run src/components/search-dialog.test.tsx`. Expected: 9 passed, with no `act(...)` or unhandled-rejection warnings in the output. If a test is flaky because of the debounce, increase the `findBy` timeout rather than adding fake timers, which fight Base UI's own timers.

- [ ] **Step 6: Run `npm run lint`,** then commit with a detailed message.

---

### Task 7: AppHeader, layout wiring, breadcrumbs on pages, remove the sidebar

**Files:**
- Create: `src/components/app-header.tsx`
- Modify: `src/app/layout.tsx`
- Modify the six internal pages: `src/app/objectives/new/page.tsx`, `src/app/objectives/[id]/page.tsx`, `src/app/objectives/[id]/edit/page.tsx`, `src/app/objectives/[id]/weeks/[weekId]/page.tsx`, `src/app/objectives/[id]/weeks/[weekId]/edit/page.tsx`, `src/app/objectives/[id]/weeks/[weekId]/tasks/[taskId]/edit/page.tsx`
- Delete: `src/components/sidebar.tsx`, `src/components/sidebar.test.tsx`

**Interfaces:**
- Consumes:
  - `getTodaySummary` (Task 2) and `search` (Task 3)
  - `DaySummary` and `Breadcrumbs` (Task 4)
  - `HeaderNav` and `BottomNav` (Task 5)
  - `SearchDialog` (Task 6)
  - `ThemeToggle` (existing: `{ theme, onChange, className?, labelClassName? }`)
  - `setTheme` and `getTheme` (existing)
- Produces: `AppHeader(props: { theme: Theme; onThemeChange: (theme: Theme) => Promise<void> })`, an async Server Component.

- [ ] **Step 1: Implement `src/components/app-header.tsx`:**

```tsx
import Link from 'next/link'
import { getTodaySummary } from '@/lib/actions/summary'
import { search } from '@/lib/actions/search'
import { BottomNav } from '@/components/bottom-nav'
import { DaySummary } from '@/components/day-summary'
import { HeaderNav } from '@/components/header-nav'
import { SearchDialog } from '@/components/search-dialog'
import { ThemeToggle } from '@/components/theme-toggle'
import type { Theme } from '@/lib/theme'

export async function AppHeader({
  theme,
  onThemeChange,
}: {
  theme: Theme
  onThemeChange: (theme: Theme) => Promise<void>
}) {
  const summary = await getTodaySummary()

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:px-8">
          <Link href="/" className="text-base font-bold text-accent-foreground">
            Metas
          </Link>
          <HeaderNav />
          <div className="flex-1" />
          <SearchDialog onSearch={search} />
          <DaySummary {...summary} />
          <ThemeToggle
            theme={theme}
            onChange={onThemeChange}
            className="px-2 text-muted-foreground hover:text-foreground"
            labelClassName="sr-only"
          />
        </div>
      </header>
      <BottomNav />
    </>
  )
}
```

`ThemeToggle`'s base classes use `text-sidebar-foreground/60`. If the passed `text-muted-foreground` doesn't win, because tailwind-merge treats them as the same group, check that `cn` merges them. It does, since both are text-color utilities.

- [ ] **Step 2: Update `src/app/layout.tsx`.** Replace the `Sidebar` import and element with `AppHeader`, and drop `md:pl-14` from the content wrapper:

```tsx
import { AppHeader } from "@/components/app-header";
// (remove: import { Sidebar } from "@/components/sidebar";)
```

```tsx
        <AppHeader theme={theme} onThemeChange={setTheme} />
        <div
          id="conteudo"
          tabIndex={-1}
          className="pb-[calc(3.5rem_+_env(safe-area-inset-bottom))] outline-none md:pb-0"
        >
          {children}
        </div>
```

The skip link stays first in `<body>`.

- [ ] **Step 3: Delete the sidebar.** Run `git rm src/components/sidebar.tsx src/components/sidebar.test.tsx`. Its active-link cases now live in `src/lib/navigation.test.ts` (Task 1), and its bottom-bar cases in `bottom-nav.test.tsx` (Task 5). Then run `grep -rn "sidebar" src --include=*.tsx`. Only `ui/` token names like `bg-sidebar` may remain.

- [ ] **Step 4: Add breadcrumbs to the six pages.** Each one renders `<Breadcrumbs items={...} />` as the first child of `<main>` and imports it with `import { Breadcrumbs } from '@/components/breadcrumbs'`. Use exactly these items:

  - `objectives/new/page.tsx`:
    `[{ label: 'Objetivos', href: '/objectives' }, { label: 'Novo objetivo' }]`
  - `objectives/[id]/page.tsx`. `objective` is already loaded:
    `[{ label: 'Objetivos', href: '/objectives' }, { label: objective.title }]`
  - `objectives/[id]/edit/page.tsx`. `objective` is already loaded:
    `[{ label: 'Objetivos', href: '/objectives' }, { label: objective.title, href: `/objectives/${id}` }, { label: 'Editar' }]`
  - `objectives/[id]/weeks/[weekId]/page.tsx`. Add `import { getObjective } from '@/lib/actions/objectives'`, and after `goal` is loaded add `const objective = await getObjective(id)` and `if (!objective) notFound()`:
    `[{ label: 'Objetivos', href: '/objectives' }, { label: objective.title, href: `/objectives/${id}` }, { label: goal.title }]`
  - `objectives/[id]/weeks/[weekId]/edit/page.tsx`. Load `objective` as above:
    `[{ label: 'Objetivos', href: '/objectives' }, { label: objective.title, href: `/objectives/${id}` }, { label: goal.title, href: `/objectives/${id}/weeks/${weekId}` }, { label: 'Editar' }]`
  - `objectives/[id]/weeks/[weekId]/tasks/[taskId]/edit/page.tsx`. Add `getObjective` and `getWeeklyGoal` (from `@/lib/actions/weeklyGoals`) lookups with `notFound()` guards:
    `[{ label: 'Objetivos', href: '/objectives' }, { label: objective.title, href: `/objectives/${id}` }, { label: goal.title, href: `/objectives/${id}/weeks/${weekId}` }, { label: task.title }, { label: 'Editar' }]`

  Here `task.title` has no `href`; the edit page is its only page, so it renders as plain text, which `Breadcrumbs` already does for items without `href`.

- [ ] **Step 5: Run the full suite, typecheck and lint.** Run `npm test`, `npx tsc --noEmit 2>&1 | grep -v "\.test\.ts"` and `npm run lint`. Expected: everything green, with no errors outside the pre-existing test fixtures.

- [ ] **Step 6: Run the production build.** Run `npx next build`. Expected: success, all routes `ƒ`. If it complains that `'use server'` files export non-async values (`TodaySummary` type exports are fine, constants are not), move the offending export to a non-action module.

- [ ] **Step 7: Commit** with a detailed message listing every file and the behavior change: the rail is gone, the header is in, the bottom bar has labels, and the six pages have breadcrumbs.

---

### Task 8: Verify in the browser and merge into develop

**Files:** none, unless a check fails. A fix goes in its own commit on the branch.

- [ ] **Step 1: Run a production server on a spare port.** Use `npx next start -p 3100` after the Task 7 build. This avoids the user's dev server and its stale cache. Check both themes; toggle with the header button.
  - **Desktop:** the header shows brand, tabs (the active one highlighted), "Buscar… Ctrl K", the summary and the theme toggle. There is no left rail, and content is no longer offset.
  - **Breadcrumbs** on all six routes, matching Task 7's table. Every link works.
  - **Search:**
    - Ctrl+K opens it; typing shows grouped results.
    - ↓/↑ highlight wraps; Enter navigates; Esc closes.
    - The "Nada encontrado" and "Digite pelo menos 2 letras" messages appear when they should.
  - **Summary freshness:**
    - Toggle a task on Hoje, and on a weekly goal page. The header count updates on the same screen without a reload.
    - If it does not, add `revalidatePath('/', 'layout')` to `toggleDailyTask`, `createDailyTask(s)`, `updateDailyTask` and `deleteDailyTask` in `src/lib/actions/dailyTasks.ts`. Extend the `revalidatePath` assertions in `dailyTasks.test.ts`, then re-check and commit.
  - **At 375×812:**
    - The header shows brand, "3/5", the magnifier and the toggle.
    - The bottom bar shows Hoje and Objetivos with labels.
    - A long objective title truncates in breadcrumbs.
    - `document.documentElement.scrollWidth === 375`.
- [ ] **Step 2: Stop the 3100 server.** Leave the theme cookie as it was found.
- [ ] **Step 3: Merge.** Run `git checkout develop`, then `git merge --no-ff feature/header-navegacao -F <file>`. The message must be detailed, list the impacted areas and end with the exact trailer. Then run `git branch -d feature/header-navegacao`. Do not push and do not touch `master` without the user's go-ahead.
