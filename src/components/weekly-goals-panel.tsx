'use client'

import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { AddWeeklyGoalCard } from '@/components/add-weekly-goal-card'
import { PastWeekRow } from '@/components/past-week-row'
import { WeeklyGoalCard } from '@/components/weekly-goal-card'
import type { PastWeekSummary, WeeklyGoalWithTasks } from '@/lib/actions/weeklyGoals'

const RECENT_PAST_WEEKS = 3

export function WeeklyGoalsPanel({
  goals,
  pastWeeks = [],
  onLoadWeek,
  onCreateTasks,
  onCreateWeeklyGoal,
  onDeleteWeeklyGoal,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
  openNewGoal,
}: {
  /** The current and future weeks, shown in full. */
  goals: WeeklyGoalWithTasks[]
  /** Earlier weeks, newest first, as summaries whose goals load on demand. */
  pastWeeks?: PastWeekSummary[]
  onLoadWeek?: (weekStart: string) => Promise<WeeklyGoalWithTasks[]>
  onCreateTasks: (weeklyGoalId: string, formData: FormData) => Promise<void>
  onCreateWeeklyGoal: (formData: FormData) => Promise<void>
  onDeleteWeeklyGoal: (weeklyGoalId: string) => Promise<void>
  onToggleTask: (taskId: string) => Promise<void>
  onUpdateTask: (taskId: string, formData: FormData) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
  openNewGoal?: boolean
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAllPast, setShowAllPast] = useState(false)
  const visiblePast = showAllPast ? pastWeeks : pastWeeks.slice(0, RECENT_PAST_WEEKS)
  const extraCount = pastWeeks.length - RECENT_PAST_WEEKS
  const togglePastRef = useRef<HTMLButtonElement>(null)

  function togglePast() {
    if (!showAllPast) {
      setShowAllPast(true)
      return
    }
    // The list shrinks above the button: commit that first, then keep the button on screen.
    flushSync(() => setShowAllPast(false))
    togglePastRef.current?.scrollIntoView({ block: 'nearest' })
  }

  return (
    <div className="flex flex-col gap-4">
      {goals.map((goal) => (
        <WeeklyGoalCard
          key={goal.id}
          goal={goal}
          expanded={expandedId === goal.id}
          onToggleExpand={() => setExpandedId((current) => (current === goal.id ? null : goal.id))}
          onCreateTasks={(formData) => onCreateTasks(goal.id, formData)}
          onDelete={() => onDeleteWeeklyGoal(goal.id)}
          onToggleTask={onToggleTask}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
        />
      ))}
      <div id="nova-meta" className="scroll-mt-20">
        <AddWeeklyGoalCard onCreate={onCreateWeeklyGoal} defaultOpen={openNewGoal} />
      </div>

      {onLoadWeek && pastWeeks.length > 0 && (
        <section aria-labelledby="semanas-anteriores" className="mt-4 flex flex-col gap-2">
          <h2 id="semanas-anteriores" className="text-sm font-semibold text-muted-foreground">
            Semanas anteriores
          </h2>
          {visiblePast.map((week) => (
            <PastWeekRow
              key={week.weekStart}
              week={week}
              onLoadWeek={onLoadWeek}
              handlers={{ onCreateTasks, onDeleteWeeklyGoal, onToggleTask, onUpdateTask, onDeleteTask }}
            />
          ))}
          {extraCount > 0 && (
            <button
              ref={togglePastRef}
              type="button"
              aria-expanded={showAllPast}
              onClick={togglePast}
              className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showAllPast ? 'Ver menos' : `Ver mais ${extraCount} ${extraCount === 1 ? 'semana' : 'semanas'}`}
            </button>
          )}
        </section>
      )}
    </div>
  )
}
