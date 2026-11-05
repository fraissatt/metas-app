import { addAppDays, differenceInAppDays, startOfAppDay } from '@/lib/dates'

/** Where the ideal line ends: the middle of the 90–95% the user asked for. */
export const IDEAL_GOAL = 0.93

/** Days of recent history the projection's pace is measured over. */
const PACE_WINDOW_DAYS = 14

export type PaceTask = { date: Date; completed: boolean; completedAt: Date | null }

/** Percentages, 0–100. `real` is null after today, `projection` is null up to the day before today. */
export type PacePoint = { day: Date; ideal: number; real: number | null; projection: number | null }

export type PaceSummary = {
  donePercent: number
  idealPercent: number
  projectedPercent: number | null
  /** How far below the ideal the real line is today; 0 when level or ahead. */
  gapPoints: number
  /** Extra tasks per week for the projection to reach the ideal end; null when it already does. */
  tasksPerWeekToCatchUp: number | null
}

export type PaceInput = {
  tasks: PaceTask[]
  startDate: Date
  targetDate: Date | null
  completedAt: Date | null
  today: Date
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high)

/**
 * Daily series for the pace chart of one objective: the ideal line, the real
 * accumulated progress up to today, and a projection at the current pace.
 *
 * All three are percentages of the objective's planned tasks. Days are counted
 * as offsets from the start so every comparison is plain integer math; the
 * Brasília day math itself stays in `dates.ts`.
 *
 * The real line only ever rises or stays flat: a task is counted on the day it
 * was completed (`completedAt`, falling back to its scheduled day), and one
 * completed before the start or after the end lands on the first or last day
 * instead of being dropped.
 */
export function buildPaceSeries(input: PaceInput): { points: PacePoint[]; summary: PaceSummary } | null {
  const { tasks, targetDate, completedAt } = input
  if (tasks.length === 0) return null

  const start = startOfAppDay(input.startDate)
  const lastPlanned = Math.max(...tasks.map((task) => differenceInAppDays(task.date, start)))
  const lastIndex = Math.max(0, targetDate ? differenceInAppDays(targetDate, start) : lastPlanned)
  const dayIndex = (date: Date) => clamp(differenceInAppDays(date, start), 0, lastIndex)

  const total = tasks.length
  const plannedOn = new Array<number>(lastIndex + 1).fill(0)
  const doneOn = new Array<number>(lastIndex + 1).fill(0)
  for (const task of tasks) {
    plannedOn[dayIndex(task.date)] += 1
    if (task.completed) doneOn[dayIndex(task.completedAt ?? task.date)] += 1
  }

  const todayIndex = dayIndex(input.today)
  const completedIndex = completedAt ? dayIndex(completedAt) : null
  const lastRealIndex = completedIndex ?? todayIndex

  // Pace over the recent window, as a share of the plan per day.
  const windowDays = Math.min(PACE_WINDOW_DAYS, todayIndex + 1)
  let recentDone = 0
  for (let i = todayIndex - windowDays + 1; i <= todayIndex; i += 1) recentDone += doneOn[i]
  const pacePercentPerDay = (recentDone / windowDays / total) * 100

  const points: PacePoint[] = []
  let planned = 0
  let done = 0
  let realToday = 0
  for (let i = 0; i <= lastIndex; i += 1) {
    planned += plannedOn[i]
    done += doneOn[i]
    const real = i <= lastRealIndex ? (done / total) * 100 : null
    if (i === lastRealIndex) realToday = (done / total) * 100

    let projection: number | null = null
    if (completedIndex === null && i >= todayIndex) {
      projection = Math.min(100, realToday + pacePercentPerDay * (i - todayIndex))
    }
    points.push({ day: addAppDays(start, i), ideal: IDEAL_GOAL * 100 * (planned / total), real, projection })
  }

  const idealToday = points[Math.min(lastRealIndex, lastIndex)].ideal
  const projectedPercent = completedIndex === null ? points[lastIndex].projection : null
  const idealEnd = IDEAL_GOAL * 100

  let tasksPerWeekToCatchUp: number | null = null
  const daysLeft = lastIndex - todayIndex
  if (projectedPercent !== null && projectedPercent < idealEnd && daysLeft > 0) {
    const missingTasks = ((idealEnd - projectedPercent) / 100) * total
    tasksPerWeekToCatchUp = Math.ceil(missingTasks / (daysLeft / 7))
  }

  return {
    points,
    summary: {
      donePercent: realToday,
      idealPercent: idealToday,
      projectedPercent,
      gapPoints: Math.max(0, idealToday - realToday),
      tasksPerWeekToCatchUp,
    },
  }
}
