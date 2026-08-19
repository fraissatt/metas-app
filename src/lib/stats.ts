import { addWeeks, isWithinInterval, max, min } from 'date-fns'
import { getWeekBounds } from '@/lib/dates'

export type WeekWindowEntry = { weekStart: Date; active: boolean }

export type LifetimeStats = {
  totalCompleted: number
  firstCompletedAt: Date | null
  weekWindow: WeekWindowEntry[]
}

const DEFAULT_MAX_WEEKS = 8

/**
 * Buckets completion timestamps into consecutive weeks, oldest first.
 *
 * The window is adaptive, not fixed: it starts at the week of the earliest
 * completion and is only clamped to `maxWeeks` when history runs longer than
 * that. Someone two weeks into using the app sees two dots, not eight with six
 * unlit — which would read as failure to a user who has done nothing wrong.
 */
export function buildWeekWindow(
  completedAts: Date[],
  now: Date,
  maxWeeks: number = DEFAULT_MAX_WEEKS,
): WeekWindowEntry[] {
  if (completedAts.length === 0) return []

  const currentWeekStart = getWeekBounds(now).weekStart
  const earliestWeekStart = getWeekBounds(min(completedAts)).weekStart
  const cappedStart = addWeeks(currentWeekStart, -(maxWeeks - 1))
  // Clamped on both sides: never earlier than the cap, never later than the
  // current week (which a clock-skewed future timestamp could otherwise force).
  const windowStart = min([max([earliestWeekStart, cappedStart]), currentWeekStart])

  const entries: WeekWindowEntry[] = []
  for (let weekStart = windowStart; weekStart <= currentWeekStart; weekStart = addWeeks(weekStart, 1)) {
    const { weekEnd } = getWeekBounds(weekStart)
    entries.push({
      weekStart,
      active: completedAts.some((completedAt) =>
        isWithinInterval(completedAt, { start: weekStart, end: weekEnd }),
      ),
    })
  }

  return entries
}
