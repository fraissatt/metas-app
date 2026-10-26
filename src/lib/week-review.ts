import {
  addAppWeeks,
  appWeekdayIndex,
  formatDayKey,
  formatDayMonth,
  formatWeekRange,
  getWeekBounds,
  getWeekDays,
} from '@/lib/dates'
import { buildDayDots, compoundFactor, countDaysDone, type DayDot, type TaskDay } from '@/lib/day-dots'
import { isGoalFulfilled } from '@/lib/objectives'

/** Monday = 0 … Sunday = 6. The current week is reviewed from Saturday on. */
const WEEKEND_FROM = 5
/** The previous week's invitation stays on Hoje until Wednesday. */
const INVITE_UNTIL = 2
/** "Em 3 meses". */
export const PROJECTION_WEEKS = 13
/** The pace a projection shows when the week itself had no day done. */
export const ASSUMED_DAYS_PER_WEEK = 3

export type ReviewWeek = {
  weekStart: Date
  /** Where ticked goals go: the week after the current one, or the current one. */
  repeatInto: 'next' | 'current'
}

/**
 * At the weekend, the week that is ending (when it was planned at all).
 * Otherwise the most recent week before the current one that had goals — the
 * same "last planned week" the "Ficou para trás" card uses, so someone back
 * after weeks away reviews their last real week, not an empty one.
 */
export function pickReviewWeek(
  now: Date,
  { currentWeekHasGoals, lastPlannedWeekStart }: { currentWeekHasGoals: boolean; lastPlannedWeekStart: Date | null },
): ReviewWeek | null {
  if (appWeekdayIndex(now) >= WEEKEND_FROM && currentWeekHasGoals) {
    return { weekStart: getWeekBounds(now).weekStart, repeatInto: 'next' }
  }
  return lastPlannedWeekStart ? { weekStart: lastPlannedWeekStart, repeatInto: 'current' } : null
}

/**
 * Whether Hoje should invite the review. Narrow on purpose: the end of the
 * week, and the first days of the next one for the week just gone. Outside
 * that the page still works, but nothing asks.
 */
export function isInviteDue(now: Date, week: ReviewWeek): boolean {
  const day = appWeekdayIndex(now)
  if (week.repeatInto === 'next') return day >= WEEKEND_FROM
  const previousWeekStart = addAppWeeks(getWeekBounds(now).weekStart, -1)
  return day <= INVITE_UNTIL && week.weekStart.getTime() === previousWeekStart.getTime()
}

/** The week that ticked goals are copied into. */
export function repeatTargetWeek(now: Date, reviewWeekStart: Date): { weekStart: Date; weekEnd: Date } {
  const current = getWeekBounds(now)
  return reviewWeekStart.getTime() === current.weekStart.getTime()
    ? getWeekBounds(addAppWeeks(current.weekStart, 1))
    : current
}

export type ReviewGoalInput = {
  id: string
  title: string
  objectiveTitle: string
  recurring: boolean
  objectiveCompleted: boolean
  /** A goal with the same objective and title already exists in the target week. */
  alreadyPlanned: boolean
  tasks: TaskDay[]
}

/** What the review can do with a goal: offer it, or say why not. */
export type GoalRepeat = 'choose' | 'recurring' | 'planned' | 'closed'

export type ReviewGoalRow = {
  id: string
  title: string
  objectiveTitle: string
  completed: number
  total: number
  fulfilled: boolean
  repeat: GoalRepeat
}

/** Plain data (no Dates), so it crosses into the client component as is. */
export type WeekReviewData = {
  weekKey: string
  rangeLabel: string
  repeatInto: ReviewWeek['repeatInto']
  reviewedOn: string | null
  dots: DayDot[]
  daysDone: number
  tasksCompleted: number
  tasksTotal: number
  /** Tasks completed minus the week before's; null when that week had none. */
  previousDelta: number | null
  compound: { before: number; after: number }
  projection: { daysPerWeek: number; assumed: boolean; from: number; to: number }
  goals: ReviewGoalRow[]
}

export type WeekSummary = { dots: DayDot[]; daysDone: number; tasksCompleted: number }

/** The headline numbers of a week: its seven dots, days done and tasks done. */
export function summarizeWeek(weekStart: Date, tasks: TaskDay[], now: Date): WeekSummary {
  return {
    dots: buildDayDots(tasks, getWeekDays(weekStart), now),
    daysDone: countDaysDone(tasks),
    tasksCompleted: tasks.filter((task) => task.completed).length,
  }
}

function goalRepeat(goal: ReviewGoalInput): GoalRepeat {
  // A completed objective stops everything, recurring goals included.
  if (goal.objectiveCompleted) return 'closed'
  if (goal.recurring) return 'recurring'
  if (goal.alreadyPlanned) return 'planned'
  return 'choose'
}

export function buildWeekReview({
  week,
  now,
  goals,
  previousWeekTasks,
  daysDoneBefore,
  reviewedAt,
}: {
  week: ReviewWeek
  now: Date
  goals: ReviewGoalInput[]
  previousWeekTasks: TaskDay[]
  /** All-time days done before the week starts. */
  daysDoneBefore: number
  reviewedAt: Date | null
}): WeekReviewData {
  const tasks = goals.flatMap((goal) => goal.tasks)
  const { dots, daysDone, tasksCompleted } = summarizeWeek(week.weekStart, tasks, now)
  const daysAfter = daysDoneBefore + daysDone
  const daysPerWeek = daysDone > 0 ? daysDone : ASSUMED_DAYS_PER_WEEK

  return {
    weekKey: formatDayKey(week.weekStart),
    rangeLabel: formatWeekRange(week.weekStart),
    repeatInto: week.repeatInto,
    reviewedOn: reviewedAt ? formatDayMonth(reviewedAt) : null,
    dots,
    daysDone,
    tasksCompleted,
    tasksTotal: tasks.length,
    previousDelta:
      previousWeekTasks.length === 0
        ? null
        : tasksCompleted - previousWeekTasks.filter((task) => task.completed).length,
    compound: { before: compoundFactor(daysDoneBefore), after: compoundFactor(daysAfter) },
    projection: {
      daysPerWeek,
      assumed: daysDone === 0,
      from: compoundFactor(daysAfter),
      to: compoundFactor(daysAfter + daysPerWeek * PROJECTION_WEEKS),
    },
    goals: [...goals]
      .sort(
        (a, b) =>
          a.objectiveTitle.localeCompare(b.objectiveTitle, 'pt-BR') || a.title.localeCompare(b.title, 'pt-BR'),
      )
      .map((goal) => ({
        id: goal.id,
        title: goal.title,
        objectiveTitle: goal.objectiveTitle,
        completed: goal.tasks.filter((task) => task.completed).length,
        total: goal.tasks.length,
        fulfilled: isGoalFulfilled(goal.tasks),
        repeat: goalRepeat(goal),
      })),
  }
}
