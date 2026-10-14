# Interactive Presentation Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the screenshot on the presentation page with a live demo built from the app's own Hoje components, sticky beside three steps and switching view (objective, week goals, Hoje) as each step reaches the middle of the window.

**Architecture:** A pure builder makes made-up data for the current Brasília week. A client `LandingDemo` keeps the tasks in memory and renders one of three views for the active step, reusing the real `WeekGoalProgressCard` and `TodayTaskGroup` (no `⋯` menu, links inert). A client `LandingFlow` owns the active step (set by an `IntersectionObserver`) and lays out steps and demo in two columns on desktop and a sticky compact demo on phones. `Landing` renders `LandingFlow`; the screenshot figure and images are removed.

**Tech Stack:** Next.js 16 App Router (read `node_modules/next/dist/docs` before Next code, per AGENTS.md), React 19, Tailwind 4, lucide-react, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-12-apresentacao-demo-interativa-design.md`

## Global Constraints

- pt-BR copy, sentence case. Step titles: "Objetivo", "Meta da semana", "Tarefa do dia" (colours green, blue, amber). Section headings "Como funciona", "E também", "Pronto para começar?". Demo region label "Demonstração interativa"; hint "Experimente: marque uma tarefa"; reset button "Recomeçar"; live message "Passo N de 3: <título>".
- No new dependency, no database, no server action, no cookie. No raw date maths: use `src/lib/dates.ts`.
- The demo never shows the `⋯` menu (pass no update or delete handlers) and never navigates (links are inert).
- Reduced motion: no view fade and no scroll reveal. Without `IntersectionObserver` the first step stays active.
- Work stays on branch `feature/53-apresentacao-fluxo-linear` (issue #53). The branch already holds uncommitted work from the screenshot-based draft in `src/components/landing.tsx`, `src/components/landing.test.tsx`, `src/components/landing-step.tsx`, `src/app/page.test.tsx` and `public/landing/`: Tasks 3 and 4 rework or remove it. Commits are detailed, mention `Refs #53`, and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- The demo's data is for the current Brasília week even around midnight UTC (the CI runs in UTC): pinned by builder tests at fixed instants, one of them 02:08 UTC on a Monday that is still Sunday in Brasília.
- Today always has open tasks, whatever the weekday (including Sunday and Monday): pinned by builder tests.
- Ticking a task in the Hoje view moves the rings in the week view (shared state): pinned by a `LandingDemo` test.
- No link inside the demo can navigate or take focus: pinned by a test that checks `defaultPrevented` and `tabindex`.
- Without `IntersectionObserver` the page still renders with step 1 active: pinned by a `LandingFlow` test.
- The screenshots are gone from the page and from `public/`: pinned by the landing test (no `img`) and checked by listing the folder.

---

### Task 1: The demo data builder

**Files:**
- Create: `src/lib/landing-demo.ts`
- Create: `src/lib/landing-demo.test.ts`

**Interfaces:**
- Consumes: `appToday`, `addAppDays`, `addAppWeeks`, `differenceInAppDays`, `getWeekBounds`, `isSameAppDay` from `@/lib/dates`.
- Produces: `type DemoGoal = WeeklyGoal & { objective: Objective; dailyTasks: DailyTask[] }`, `type LandingDemoData = { objective: Objective; goals: DemoGoal[] }` and `buildLandingDemo(now?: Date): LandingDemoData`.

- [ ] **Step 1: Write the failing tests**

`src/lib/landing-demo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { appToday, differenceInAppDays, formatDayKey, getWeekBounds, isSameAppDay } from '@/lib/dates'
import { buildLandingDemo } from '@/lib/landing-demo'

// Wednesday 14/10/2026 at 12:00 in Brasília.
const WEDNESDAY = new Date('2026-10-14T15:00:00Z')
// Monday 12/10/2026 at 02:08 UTC is still Sunday 11/10 (23:08) in Brasília.
const SUNDAY_NIGHT = new Date('2026-10-12T02:08:00Z')
const MONDAY = new Date('2026-10-12T15:00:00Z')

const todaysTasks = (now: Date) => {
  const today = appToday(now)
  return buildLandingDemo(now).goals.flatMap((goal) => goal.dailyTasks.filter((task) => isSameAppDay(task.date, today)))
}

describe('buildLandingDemo', () => {
  it('builds one active objective whose goals all belong to it and to the current week', () => {
    const { objective, goals } = buildLandingDemo(WEDNESDAY)
    const { weekStart } = getWeekBounds(appToday(WEDNESDAY))

    expect(objective.status).toBe('ACTIVE')
    expect(goals.length).toBeGreaterThanOrEqual(2)
    for (const goal of goals) {
      expect(goal.objective.id).toBe(objective.id)
      expect(goal.objectiveId).toBe(objective.id)
      expect(formatDayKey(goal.weekStart)).toBe(formatDayKey(weekStart))
    }
  })

  it('marks the days before today as done and leaves today and later open', () => {
    const today = appToday(WEDNESDAY)
    for (const goal of buildLandingDemo(WEDNESDAY).goals) {
      for (const task of goal.dailyTasks) {
        const past = differenceInAppDays(today, task.date) > 0
        expect(task.completed, `${goal.title} ${formatDayKey(task.date)}`).toBe(past)
      }
    }
  })

  it('gives every goal at least one open task today, on any weekday', () => {
    for (const now of [WEDNESDAY, SUNDAY_NIGHT, MONDAY, new Date('2026-10-18T15:00:00Z')]) {
      const demo = buildLandingDemo(now)
      for (const goal of demo.goals) {
        const today = appToday(now)
        const open = goal.dailyTasks.filter((task) => isSameAppDay(task.date, today) && !task.completed)
        expect(open.length, `${goal.title} on ${now.toISOString()}`).toBeGreaterThan(0)
      }
    }
  })

  it('follows the Brasília calendar, not the machine clock, around midnight UTC', () => {
    const { weekStart } = getWeekBounds(appToday(SUNDAY_NIGHT))
    expect(formatDayKey(weekStart)).toBe('2026-10-05')
    expect(todaysTasks(SUNDAY_NIGHT).every((task) => formatDayKey(task.date) === '2026-10-11')).toBe(true)
  })

  it('uses unique ids and never leaves a task outside its goal week', () => {
    const { goals } = buildLandingDemo(WEDNESDAY)
    const ids = goals.flatMap((goal) => [goal.id, ...goal.dailyTasks.map((task) => task.id)])
    expect(new Set(ids).size).toBe(ids.length)
    for (const goal of goals) {
      for (const task of goal.dailyTasks) {
        expect(task.weeklyGoalId).toBe(goal.id)
        expect(task.date >= goal.weekStart && task.date <= goal.weekEnd).toBe(true)
      }
    }
  })

  it('has an objective that started before this week and ends after it', () => {
    const { objective } = buildLandingDemo(WEDNESDAY)
    const today = appToday(WEDNESDAY)
    expect(differenceInAppDays(today, objective.startDate)).toBeGreaterThan(7)
    expect(objective.targetDate && differenceInAppDays(objective.targetDate, today)).toBeGreaterThan(7)
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/lib/landing-demo.test.ts`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement**

`src/lib/landing-demo.ts`:

```ts
import type { DailyTask, Objective, WeeklyGoal } from '@prisma/client'
import { addAppDays, addAppWeeks, appToday, differenceInAppDays, getWeekBounds } from '@/lib/dates'

export type DemoGoal = WeeklyGoal & { objective: Objective; dailyTasks: DailyTask[] }
export type LandingDemoData = { objective: Objective; goals: DemoGoal[] }

type Plan = { id: string; title: string; task: string; days: number[] } // 0 = Monday ... 6 = Sunday

const PLANS: Plan[] = [
  { id: 'vocabulario', title: 'Estudar vocabulário todos os dias', task: 'Aprender 10 palavras novas', days: [0, 1, 2, 3, 4] },
  { id: 'conversacao', title: 'Praticar conversação', task: 'Ouvir podcast em inglês no trajeto', days: [1, 3, 5] },
]

/**
 * Made-up data for the presentation demo, for the current week in Brasília:
 * the days before today are done, today and the days after are open, and every
 * goal has a task today so the Hoje view is never empty. Shaped like the rows
 * the real components read, so they render it unchanged.
 */
export function buildLandingDemo(now: Date = new Date()): LandingDemoData {
  const today = appToday(now)
  const { weekStart, weekEnd } = getWeekBounds(today)
  const todayOffset = differenceInAppDays(today, weekStart)

  const objective: Objective = {
    id: 'demo-objective',
    title: 'Falar inglês com fluência',
    description: null,
    startDate: addAppWeeks(weekStart, -6),
    targetDate: addAppWeeks(weekStart, 18),
    status: 'ACTIVE',
    completedAt: null,
    createdAt: addAppWeeks(weekStart, -6),
    userId: 'demo',
  }

  const goals = PLANS.map((plan): DemoGoal => {
    const goalId = `demo-goal-${plan.id}`
    const offsets = [...new Set([...plan.days, todayOffset])].sort((a, b) => a - b)
    const dailyTasks = offsets.map((offset): DailyTask => {
      const date = addAppDays(weekStart, offset)
      const completed = offset < todayOffset
      return {
        id: `demo-task-${plan.id}-${offset}`,
        title: plan.task,
        weeklyGoalId: goalId,
        date,
        completed,
        completedAt: completed ? date : null,
      }
    })
    return {
      id: goalId,
      title: plan.title,
      objectiveId: objective.id,
      weekStart,
      weekEnd,
      status: 'ACTIVE',
      recurring: true,
      objective,
      dailyTasks,
    }
  })

  return { objective, goals }
}
```

- [ ] **Step 4: Run to see them pass, then under the three zones**

Run: `npx vitest run src/lib/landing-demo.test.ts && node scripts/test-both-tz.mjs src/lib/landing-demo.test.ts`
Expected: PASS in UTC, America/Sao_Paulo and America/Rio_Branco.

- [ ] **Step 5: Commit**

```bash
git add src/lib/landing-demo.ts src/lib/landing-demo.test.ts
git commit -m "feat: build the made-up data for the presentation demo" -m "Refs #53. One objective with two weekly goals for the current Brasilia week: days before today done, today and later open, and every goal has a task today. Shaped like the real rows so the app's own components render it. Tested at fixed instants, including 02:08 UTC on a Monday that is still Sunday in Brasilia. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The interactive demo panel

**Files:**
- Create: `src/components/landing-demo.tsx`
- Create: `src/components/landing-demo.test.tsx`

**Interfaces:**
- Consumes: `LandingDemoData`, `DemoGoal` (Task 1); `TodayTaskGroup`, `WeekGoalProgressCard`; `groupTasksByWeeklyGoal` from `@/lib/tasks`; `appToday`, `isSameAppDay`, `formatDate`, `differenceInAppDays` from `@/lib/dates`; `Button` from `@/components/ui/button`.
- Produces: `LandingDemo({ data, step }: { data: LandingDemoData; step: 0 | 1 | 2 })`, a client component rendering a region labelled "Demonstração interativa". Its tasks live in its own state, so the state survives `step` changes.

- [ ] **Step 1: Write the failing tests**

`src/components/landing-demo.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LandingDemo } from '@/components/landing-demo'
import { buildLandingDemo } from '@/lib/landing-demo'

// Wednesday 14/10/2026: Monday and Tuesday are done, Wednesday (today) is open.
const data = buildLandingDemo(new Date('2026-10-14T15:00:00Z'))
const ANKI = 'Aprender 10 palavras novas'

describe('LandingDemo', () => {
  it('is a labelled region', () => {
    render(<LandingDemo data={data} step={2} />)
    expect(screen.getByRole('region', { name: 'Demonstração interativa' })).toBeInTheDocument()
  })

  it('step 1 shows the objective with its deadline and progress', () => {
    render(<LandingDemo data={data} step={0} />)
    expect(screen.getByText('Falar inglês com fluência')).toBeInTheDocument()
    expect(screen.getByText(/Prazo:/)).toBeInTheDocument()
    expect(screen.getByText('3 de 9 tarefas da semana concluídas')).toBeInTheDocument()
  })

  it('step 2 shows the week goals with their progress ring', () => {
    render(<LandingDemo data={data} step={1} />)
    expect(screen.getByText('Estudar vocabulário todos os dias')).toBeInTheDocument()
    expect(screen.getByText('Praticar conversação')).toBeInTheDocument()
    expect(screen.getAllByTestId('progress-ring')).toHaveLength(2)
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it("step 3 shows today's tasks as checkboxes, all open, with no edit menu", () => {
    render(<LandingDemo data={data} step={2} />)
    expect(screen.getByRole('checkbox', { name: ANKI })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Ouvir podcast em inglês no trajeto' })).not.toBeChecked()
    expect(screen.queryByText('⋯')).toBeNull()
  })

  it('ticking a task completes the day for its goal', async () => {
    render(<LandingDemo data={data} step={2} />)
    await userEvent.click(screen.getByRole('checkbox', { name: ANKI }))
    expect(screen.getByRole('checkbox', { name: ANKI })).toBeChecked()
    expect(screen.getByText('✓ feito')).toBeInTheDocument()
  })

  it('shares the tasks between the views: a tick in Hoje moves the week progress', async () => {
    const { rerender } = render(<LandingDemo data={data} step={2} />)
    await userEvent.click(screen.getByRole('checkbox', { name: ANKI }))
    rerender(<LandingDemo data={data} step={1} />)
    expect(screen.getByText('60%')).toBeInTheDocument()
    rerender(<LandingDemo data={data} step={0} />)
    expect(screen.getByText('4 de 9 tarefas da semana concluídas')).toBeInTheDocument()
  })

  it('unticking reverts', async () => {
    render(<LandingDemo data={data} step={2} />)
    await userEvent.click(screen.getByRole('checkbox', { name: ANKI }))
    await userEvent.click(screen.getByRole('checkbox', { name: ANKI }))
    expect(screen.getByRole('checkbox', { name: ANKI })).not.toBeChecked()
    expect(screen.queryByText('✓ feito')).toBeNull()
  })

  it('shows a hint until the first tick, and Recomeçar brings back the data and the hint', async () => {
    render(<LandingDemo data={data} step={2} />)
    expect(screen.getByText('Experimente: marque uma tarefa')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: ANKI }))
    expect(screen.queryByText('Experimente: marque uma tarefa')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Recomeçar' }))
    expect(screen.getByRole('checkbox', { name: ANKI })).not.toBeChecked()
    expect(screen.getByText('Experimente: marque uma tarefa')).toBeInTheDocument()
  })

  it('keeps every link inside the demo inert', () => {
    render(<LandingDemo data={data} step={1} />)
    const links = screen.getAllByRole('link', { hidden: true })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) {
      expect(link).toHaveAttribute('tabindex', '-1')
      const click = createEvent.click(link)
      fireEvent(link, click)
      expect(click.defaultPrevented).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/components/landing-demo.test.tsx`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement**

`src/components/landing-demo.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { TodayTaskGroup } from '@/components/today-task-group'
import { WeekGoalProgressCard } from '@/components/week-goal-progress-card'
import { Button } from '@/components/ui/button'
import { appToday, differenceInAppDays, formatDate, isSameAppDay } from '@/lib/dates'
import type { DemoGoal, LandingDemoData } from '@/lib/landing-demo'
import { groupTasksByWeeklyGoal } from '@/lib/tasks'

export type DemoStep = 0 | 1 | 2

function toggleTask(goals: DemoGoal[], taskId: string): DemoGoal[] {
  return goals.map((goal) => ({
    ...goal,
    dailyTasks: goal.dailyTasks.map((task) =>
      task.id === taskId
        ? { ...task, completed: !task.completed, completedAt: task.completed ? null : new Date() }
        : task,
    ),
  }))
}

function ObjectiveView({ data, goals }: { data: LandingDemoData; goals: DemoGoal[] }) {
  const { objective } = data
  const tasks = goals.flatMap((goal) => goal.dailyTasks)
  const done = tasks.filter((task) => task.completed).length
  const today = appToday()
  const total = objective.targetDate ? differenceInAppDays(objective.targetDate, objective.startDate) : 0
  const elapsed = total > 0 ? Math.min(100, Math.max(0, Math.round((differenceInAppDays(today, objective.startDate) / total) * 100))) : 0

  return (
    <div className="flex overflow-hidden rounded-lg border border-border bg-card">
      <div className="w-[3px] shrink-0 bg-primary" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-sm font-semibold">{objective.title}</p>
          {objective.targetDate && (
            <p className="text-xs text-muted-foreground">Prazo: {formatDate(objective.targetDate)}</p>
          )}
        </div>
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${elapsed}% do prazo decorrido`}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${elapsed}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{elapsed}% do prazo decorrido</p>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {done} de {tasks.length} tarefas da semana concluídas
        </p>
      </div>
    </div>
  )
}

function WeekView({ goals }: { goals: DemoGoal[] }) {
  return (
    <div className="flex flex-col gap-3">
      {goals.map((goal) => (
        <WeekGoalProgressCard key={goal.id} goal={goal} />
      ))}
    </div>
  )
}

function TodayView({ goals, onToggle }: { goals: DemoGoal[]; onToggle: (id: string) => Promise<void> }) {
  const today = appToday()
  const tasks = goals.flatMap((goal) =>
    goal.dailyTasks.filter((task) => isSameAppDay(task.date, today)).map((task) => ({ ...task, weeklyGoal: goal })),
  )
  return (
    <div className="flex flex-col gap-3">
      {groupTasksByWeeklyGoal(tasks).map((group) => (
        <TodayTaskGroup key={group.weeklyGoal.id} group={group} onToggleTask={onToggle} />
      ))}
    </div>
  )
}

export function LandingDemo({ data, step }: { data: LandingDemoData; step: DemoStep }) {
  const [goals, setGoals] = useState<DemoGoal[]>(data.goals)
  const [ticked, setTicked] = useState(false)
  const region = useRef<HTMLDivElement>(null)

  // The real cards link to pages a visitor cannot open: keep the links out of
  // the tab order too (clicks are cancelled by the capture handler below).
  useEffect(() => {
    region.current?.querySelectorAll('a').forEach((link) => link.setAttribute('tabindex', '-1'))
  }, [step, goals])

  async function onToggle(id: string) {
    setGoals((current) => toggleTask(current, id))
    setTicked(true)
  }

  function reset() {
    setGoals(data.goals)
    setTicked(false)
  }

  return (
    <div
      ref={region}
      role="region"
      aria-label="Demonstração interativa"
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest('a')) event.preventDefault()
      }}
      className="flex flex-col gap-3 [&_a]:cursor-default"
    >
      <div key={step} className="landing-view">
        {step === 0 && <ObjectiveView data={data} goals={goals} />}
        {step === 1 && <WeekView goals={goals} />}
        {step === 2 && <TodayView goals={goals} onToggle={onToggle} />}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{step === 2 && !ticked ? 'Experimente: marque uma tarefa' : ''}</p>
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          Recomeçar
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run src/components/landing-demo.test.tsx && npx tsc --noEmit && npx eslint src`
Expected: PASS, no type errors, no warnings. (Wednesday: vocabulário has 5 tasks with 2 done, conversação 4 with 1 done, so 3 of 9 and 40%.)

- [ ] **Step 5: Commit**

```bash
git add src/components/landing-demo.tsx src/components/landing-demo.test.tsx
git commit -m "feat: add the interactive demo panel" -m "Refs #53. One panel with three views (objective, week goals through the real WeekGoalProgressCard, Hoje through the real TodayTaskGroup) over tasks kept in memory, so a tick in Hoje moves the week progress. No edit menu, links inert, a hint until the first tick and a Recomecar button. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The steps, the scroll observer and the layout

**Files:**
- Create: `src/components/landing-steps.ts`
- Modify: `src/components/landing-step.tsx`
- Create: `src/components/landing-flow.tsx`
- Create: `src/components/landing-flow.test.tsx`

**Interfaces:**
- Consumes: `LandingDemo`, `DemoStep` (Task 2); `LandingDemoData` (Task 1); `LandingColor` from `landing-card.tsx`.
- Produces: `STEPS` (three items: `{ icon, title, text, color }`) from `landing-steps.ts`; `LandingStep` gains `active?: boolean`, `className?`; `LandingFlow({ data }: { data: LandingDemoData })`, a client component with the two-column layout, an `ol` labelled "Como funciona", the demo and a polite live message.

- [ ] **Step 1: Write the failing tests**

`src/components/landing-flow.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import { LandingFlow } from '@/components/landing-flow'
import { buildLandingDemo } from '@/lib/landing-demo'

const data = buildLandingDemo(new Date('2026-10-14T15:00:00Z'))

type Entry = Pick<IntersectionObserverEntry, 'isIntersecting' | 'target'>
const observers: { callback: (entries: Entry[]) => void; targets: Element[] }[] = []

class FakeObserver {
  targets: Element[] = []
  constructor(public callback: (entries: Entry[]) => void) {
    observers.push(this)
  }
  observe(element: Element) {
    this.targets.push(element)
  }
  unobserve() {}
  disconnect() {}
}

function reach(index: number) {
  const observer = observers[0]
  act(() => observer.callback([{ isIntersecting: true, target: observer.targets[index] }]))
}

beforeEach(() => {
  observers.length = 0
  vi.stubGlobal('IntersectionObserver', FakeObserver)
})
afterEach(() => vi.unstubAllGlobals())

describe('LandingFlow', () => {
  it('lists the three steps in an ordered list, the first one active', () => {
    render(<LandingFlow data={data} />)
    const list = screen.getByRole('list', { name: 'Como funciona' })
    expect(list.tagName).toBe('OL')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveAttribute('aria-current', 'step')
    expect(items[1]).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Falar inglês com fluência')).toBeInTheDocument()
  })

  it('follows the scroll: reaching a step makes it active and switches the demo view', () => {
    render(<LandingFlow data={data} />)
    const items = within(screen.getByRole('list', { name: 'Como funciona' })).getAllByRole('listitem')

    reach(1)
    expect(items[1]).toHaveAttribute('aria-current', 'step')
    expect(items[0]).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Estudar vocabulário todos os dias')).toBeInTheDocument()

    reach(2)
    expect(items[2]).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('checkbox', { name: 'Aprender 10 palavras novas' })).toBeInTheDocument()
  })

  it('announces the active step politely', () => {
    render(<LandingFlow data={data} />)
    expect(screen.getByText('Passo 1 de 3: Objetivo')).toBeInTheDocument()
    reach(2)
    expect(screen.getByText('Passo 3 de 3: Tarefa do dia')).toBeInTheDocument()
  })

  it('ignores entries that are not intersecting', () => {
    render(<LandingFlow data={data} />)
    const observer = observers[0]
    act(() => observer.callback([{ isIntersecting: false, target: observer.targets[2] }]))
    expect(screen.getByText('Passo 1 de 3: Objetivo')).toBeInTheDocument()
  })

  it('keeps the tasks the visitor ticked when the view changes', () => {
    render(<LandingFlow data={data} />)
    reach(2)
    screen.getByRole('checkbox', { name: 'Aprender 10 palavras novas' }).click()
    reach(1)
    reach(2)
    expect(screen.getByRole('checkbox', { name: 'Aprender 10 palavras novas' })).toBeChecked()
  })

  it('still renders, on step 1, where IntersectionObserver does not exist', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<LandingFlow data={data} />)
    expect(screen.getByText('Passo 1 de 3: Objetivo')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/components/landing-flow.test.tsx`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement**

`src/components/landing-steps.ts`:

```ts
import { CalendarDays, ListChecks, Target, type LucideIcon } from 'lucide-react'
import type { LandingColor } from '@/components/landing-card'

export type FlowStep = { icon: LucideIcon; title: string; text: string; color: LandingColor }

export const STEPS: readonly FlowStep[] = [
  { icon: Target, title: 'Objetivo', text: 'Defina o destino, com prazo e progresso.', color: 'green' },
  {
    icon: CalendarDays,
    title: 'Meta da semana',
    text: 'Divida o objetivo em metas para cada semana. Elas podem se repetir.',
    color: 'blue',
  },
  { icon: ListChecks, title: 'Tarefa do dia', text: 'Veja no Hoje o passo certo para cada dia.', color: 'amber' },
]
```

Modify `src/components/landing-step.tsx` (it is currently untracked from the screenshot draft; keep its content and add the two props): add `active = false` and `className` to the props; on the `<li>` set `aria-current={active ? 'step' : undefined}` and the class `cn('flex gap-4 transition-opacity motion-reduce:transition-none', active ? 'opacity-100' : 'opacity-50', className)` (import `cn` from `@/lib/utils`).

`src/components/landing-flow.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { LandingDemo, type DemoStep } from '@/components/landing-demo'
import { LandingStep } from '@/components/landing-step'
import { STEPS } from '@/components/landing-steps'
import type { LandingDemoData } from '@/lib/landing-demo'

export function LandingFlow({ data }: { data: LandingDemoData }) {
  const [active, setActive] = useState<DemoStep>(0)
  const items = useRef<(HTMLLIElement | null)[]>([])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    // A thin band around the middle of the window: the step crossing it is the one being read.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = items.current.indexOf(entry.target as HTMLLIElement)
          if (index >= 0) setActive(index as DemoStep)
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    items.current.forEach((item) => item && observer.observe(item))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-12">
      <div className="order-first lg:order-last lg:sticky lg:top-20">
        <div className="sticky top-14 z-10 max-h-[45vh] overflow-y-auto rounded-xl border border-border bg-background/90 p-3 backdrop-blur lg:static lg:max-h-[calc(100vh-7rem)]">
          <LandingDemo data={data} step={active} />
        </div>
      </div>
      <ol aria-label="Como funciona" className="flex flex-col">
        {STEPS.map((step, index) => (
          <LandingStep
            key={step.title}
            ref={(element) => {
              items.current[index] = element
            }}
            number={index + 1}
            {...step}
            active={active === index}
            last={index === STEPS.length - 1}
            className="min-h-[35vh] lg:min-h-[60vh]"
          />
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">
        Passo {active + 1} de {STEPS.length}: {STEPS[active].title}
      </p>
    </div>
  )
}
```

Because `LandingStep` is a function component, make it accept `ref` as a prop (React 19): add `ref?: React.Ref<HTMLLIElement>` to its props and pass it to the `<li>`.

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run src/components/landing-flow.test.tsx && npx tsc --noEmit && npx eslint src`
Expected: PASS, no type errors, no warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing-steps.ts src/components/landing-step.tsx src/components/landing-flow.tsx src/components/landing-flow.test.tsx
git commit -m "feat: add the scroll-driven steps and the sticky demo layout" -m "Refs #53. An IntersectionObserver on a band around the middle of the window marks the active step, which highlights it, sets aria-current, announces it politely and switches the demo view; two columns from lg with the demo sticky, a compact sticky demo on phones, and step 1 where the observer is missing. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Put the flow in the landing page and remove the screenshots

**Files:**
- Modify: `src/components/landing.tsx`
- Modify: `src/components/landing.test.tsx`
- Modify: `src/app/globals.css` (append)
- Modify: `src/app/globals.landing.test.ts`
- Delete: `public/landing/hoje-escuro.jpg`, `public/landing/hoje-claro.jpg`

**Interfaces:**
- Consumes: `LandingFlow` (Task 3), `buildLandingDemo` (Task 1), `LandingCard`.
- Produces: the finished page; CSS classes `landing-view` and `landing-reveal`.

- [ ] **Step 1: Update the tests first**

In `src/components/landing.test.tsx`: delete the test "shows the Hoje screen of the app in both themes, with alternative text"; add

```tsx
  it('has no screenshots: the demo is the showcase', () => {
    setup()
    expect(screen.queryAllByRole('img')).toHaveLength(0)
    expect(screen.getByRole('region', { name: 'Demonstração interativa' })).toBeInTheDocument()
  })
```

(The existing tests for the steps list "Como funciona", the extras, the section order and the footer stay as they are. The step titles are `h3` inside the ordered list.) The progress-bar `role="img"` in the objective view would break the `img` query: change that element in `src/components/landing-demo.tsx` from `role="img"` to `role="progressbar"` with `aria-valuenow={elapsed}`, `aria-valuemin={0}`, `aria-valuemax={100}` and keep its `aria-label`, and keep the test above.

In `src/app/globals.landing.test.ts` append:

```ts
describe('landing flow styles', () => {
  it('fades the demo view in, but not for reduced motion', () => {
    expect(css).toMatch(/\.landing-view\s*{[^}]*animation: tour-step-in/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[^}]*\.landing-view\s*{\s*animation: none/)
  })

  it('reveals sections on scroll only where scroll-driven animation exists, and not for reduced motion', () => {
    expect(css).toMatch(/@supports \(animation-timeline: view\(\)\)\s*{[^}]*\.landing-reveal/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[^}]*\.landing-reveal\s*{\s*animation: none/)
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/components/landing.test.tsx src/app/globals.landing.test.ts`
Expected: FAIL (the page still shows the screenshots; the classes are missing).

- [ ] **Step 3: Implement**

`src/app/globals.css` (append):

```css

/* Presentation demo: each view fades in; sections reveal as they scroll into
   view where the browser supports it. Reduced motion skips both. */
.landing-view {
  animation: tour-step-in 200ms ease backwards;
}

@supports (animation-timeline: view()) {
  .landing-reveal {
    animation: landing-reveal linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 40%;
  }
}

@keyframes landing-reveal {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-view {
    animation: none;
  }
  .landing-reveal {
    animation: none;
  }
}
```

`src/components/landing.tsx`: remove the `Image` import, the `STEPS` constant, the `LandingStep` and `CalendarDays`/`ListChecks`/`Target` imports, and the whole `<figure>` block; import `LandingFlow` and `buildLandingDemo`; replace the "Como funciona" section body (the `<ol>`) with `<LandingFlow data={buildLandingDemo()} />` keeping the `<h2>Como funciona</h2>`; add `landing-reveal` to the class lists of the "E também" and the closing sections. Keep `EXTRAS`, `Actions`, the hero and the footer as they are.

Delete the two images: `git rm -f public/landing/hoje-escuro.jpg public/landing/hoje-claro.jpg` (they are untracked, so a plain `rm` is enough) and confirm `ls public` shows only `icons`.

- [ ] **Step 4: Run to see them pass, then the page tests, typecheck and lint**

Run: `npx vitest run src/components/landing.test.tsx src/components/landing-demo.test.tsx src/app/globals.landing.test.ts src/app/page.test.tsx && npx tsc --noEmit && npx eslint src`
Expected: PASS, no errors, no warnings.

- [ ] **Step 5: Commit**

```bash
git add -A src public
git commit -m "feat: show the live demo on the presentation page instead of screenshots" -m "Refs #53. Como funciona now holds the scroll-driven demo; the screenshot figure and the two images are gone, the extras and the closing section reveal on scroll where the browser supports it, and the demo view fades in unless motion is reduced. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Verify in the browser, document, and open the PR

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the running app from Tasks 1 to 4.
- Produces: the README change.

- [ ] **Step 1: Run the full suite and the zone runner**

Run: `npx tsc --noEmit && npx eslint src && npx vitest run`
Expected: everything passes. Then `node scripts/test-both-tz.mjs src/lib src/components` for the three zones; expected all passing.

- [ ] **Step 2: Check it in the browser**

Start the `dev` preview (`preview_start` with name `dev`; never run `next build` while it runs), sign out, open `/`. At desktop width: scroll through "Como funciona" and confirm the demo stays on the right while the steps scroll, the active step highlights, and the demo switches objective, week goals and Hoje; tick a task in Hoje and confirm the rings in the week view and the count in the objective view follow; use "Recomeçar"; confirm no `⋯` menu and that clicking a card title does nothing. Repeat at phone width (375 px): the demo is sticky under the header, compact, and switches with the steps; no horizontal scroll. Check both themes. Confirm "E também" and the closing section reveal while scrolling. Reset the viewport and stop the preview when done. Send the owner full-page captures only after the owner asks; the owner reviews the Vercel preview of the PR.

- [ ] **Step 3: Update the README**

In the "Funcionalidades" bullet "Página de apresentação", replace its text so it describes the live demo, for example: "quem abre o site sem sessão vê, na raiz, uma demonstração ao vivo do app (com os mesmos componentes do Hoje e dados fictícios) que acompanha a rolagem pelos três passos, mais os recursos extras e três formas de entrar. Quem já está logado continua indo direto para o Hoje." In "Capturas de tela", remove the "Página de apresentação" subsection and its image line, and delete `docs/screenshots/apresentacao.jpg` (the page no longer uses it).

- [ ] **Step 4: Commit, push and open the PR**

```bash
git add README.md
git rm -q docs/screenshots/apresentacao.jpg
git commit -m "docs: describe the live demo in the README" -m "Refs #53. Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin feature/53-apresentacao-fluxo-linear
```

Open the PR into `develop` with the attribution block first, `Closes #53`, the Antes/Depois/Como foi feito/Como foi testado sections and the Claude Code footer; assign and request review from `fraissatt`; move the cards to "Em revisão"; wait for CI with `gh pr checks <n> --watch`; point the owner to the Vercel preview link of the PR for review before merging. Do not release: the owner decides when (v1.5.0 together with the "?" button).
