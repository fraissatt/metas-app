'use client'

import { useState } from 'react'
import { parseISO } from 'date-fns'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { WeeklyGoalCard } from '@/components/weekly-goal-card'
import { formatDayMonth } from '@/lib/dates'
import type { PastWeekSummary, WeeklyGoalWithTasks } from '@/lib/actions/weeklyGoals'

type Handlers = {
  onCreateTasks: (weeklyGoalId: string, formData: FormData) => Promise<void>
  onDeleteWeeklyGoal: (weeklyGoalId: string) => Promise<void>
  onToggleTask: (taskId: string) => Promise<void>
  onUpdateTask: (taskId: string, formData: FormData) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
}

/**
 * An earlier week as one compact row. Its goals and tasks are fetched only
 * when the row is opened, and fetched again after any change made inside it,
 * since this client copy isn't refreshed by the page's revalidation.
 */
export function PastWeekRow({
  week,
  onLoadWeek,
  handlers,
}: {
  week: PastWeekSummary
  onLoadWeek: (weekStart: string) => Promise<WeeklyGoalWithTasks[]>
  handlers: Handlers
}) {
  const [open, setOpen] = useState(false)
  const [goals, setGoals] = useState<WeeklyGoalWithTasks[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const percent = week.total === 0 ? 0 : Math.round((week.completed / week.total) * 100)
  const label = `Semana de ${formatDayMonth(parseISO(week.weekStart))}`

  async function load() {
    setFailed(false)
    try {
      setGoals(await onLoadWeek(week.weekStart))
    } catch {
      setFailed(true)
    }
  }

  // Runs a change, then refreshes this week's copy.
  function andReload<A extends unknown[]>(action: (...args: A) => Promise<void>) {
    return async (...args: A) => {
      await action(...args)
      await load()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next && goals === null) void load()
        }}
        className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="shrink-0 whitespace-nowrap">{label}</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
          <span className="block h-full bg-primary" style={{ width: `${percent}%` }} />
        </span>
        <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">{percent}%</span>
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="flex flex-col gap-4 pl-3">
          {failed ? (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível carregar esta semana.{' '}
              <button type="button" className="underline underline-offset-4" onClick={() => void load()}>
                Tentar de novo
              </button>
            </p>
          ) : goals === null ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            goals.map((goal) => (
              <WeeklyGoalCard
                key={goal.id}
                goal={goal}
                expanded={expandedId === goal.id}
                onToggleExpand={() => setExpandedId((current) => (current === goal.id ? null : goal.id))}
                onCreateTasks={andReload((formData: FormData) => handlers.onCreateTasks(goal.id, formData))}
                onDelete={andReload(() => handlers.onDeleteWeeklyGoal(goal.id))}
                onToggleTask={andReload(handlers.onToggleTask)}
                onUpdateTask={andReload(handlers.onUpdateTask)}
                onDeleteTask={andReload(handlers.onDeleteTask)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
