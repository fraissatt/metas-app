import { differenceInCalendarWeeks } from 'date-fns'

export type ObjectiveWeek = {
  weekStart: Date
  total: number
  completed: number
  fulfilled: boolean
}

export type ObjectiveStats = {
  weeksFulfilled: number
  tasksCompleted: number
  weeksSinceStart: number
  recentWeeks: ObjectiveWeek[]
}

type GoalLike = { weekStart: Date; dailyTasks: Array<{ completed: boolean }> }

/**
 * The single definition of a fulfilled weekly goal, used by the celebration in
 * the UI and by the per-objective week aggregation below — one concept, so the
 * number a user reads on `/objectives/[id]` means the same thing as the badge
 * they saw on the home page.
 *
 * The emptiness check is load-bearing: `[].every(…)` is `true`, so without it a
 * goal that was never given any tasks would report itself fulfilled.
 */
export function isGoalFulfilled(dailyTasks: Array<{ completed: boolean }>): boolean {
  return dailyTasks.length > 0 && dailyTasks.every((task) => task.completed)
}

/**
 * Collapses an objective's weekly goals into one entry per week, oldest first.
 * A week is fulfilled when every goal it held was fulfilled — one goal closed
 * and another left at 2/3 is not a week the user accomplished.
 */
export function buildObjectiveWeeks(goals: GoalLike[]): ObjectiveWeek[] {
  const byWeek = new Map<string, ObjectiveWeek>()

  for (const goal of goals) {
    const key = goal.weekStart.toISOString()
    const total = goal.dailyTasks.length
    const completed = goal.dailyTasks.filter((task) => task.completed).length
    const fulfilled = isGoalFulfilled(goal.dailyTasks)
    const entry = byWeek.get(key)

    if (entry) {
      entry.total += total
      entry.completed += completed
      entry.fulfilled = entry.fulfilled && fulfilled
    } else {
      byWeek.set(key, { weekStart: goal.weekStart, total, completed, fulfilled })
    }
  }

  return [...byWeek.values()].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
}

/** How the completion landed against the objective's own target, if it set one. */
export function describeSchedule(completedAt: Date, targetDate: Date | null): string | null {
  if (!targetDate) return null

  const weeks = differenceInCalendarWeeks(targetDate, completedAt, { weekStartsOn: 1 })
  if (weeks === 0) return 'na semana prevista'

  const magnitude = Math.abs(weeks)
  const unit = magnitude === 1 ? 'semana' : 'semanas'
  return `${magnitude} ${unit} ${weeks > 0 ? 'antes' : 'depois'} do previsto`
}
