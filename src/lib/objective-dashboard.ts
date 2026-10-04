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
