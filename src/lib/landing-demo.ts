import type { DailyTask, Objective, WeeklyGoal } from '@prisma/client'
import { addAppDays, addAppWeeks, appToday, differenceInAppDays, getWeekBounds } from '@/lib/dates'

export type DemoGoal = WeeklyGoal & { objective: Objective; dailyTasks: DailyTask[] }
/** `today` is the Brasília day the data was built for: the views read it instead of the clock, so server and client agree. */
export type DemoWeek = { weekStart: Date; rate: number }
export type LandingDemoData = { today: Date; objective: Objective; goals: DemoGoal[]; weeks: DemoWeek[] }

// Completion of the six weeks before this one, oldest first: a fixed story (five weeks fulfilled, the last four in a row).
const PAST_RATES = [1, 0.67, 1, 1, 1, 1]
// Each goal shows at least this many done tasks, whatever the day of the week.
const MIN_DONE = 1

type Plan = { id: string; title: string; task: string; days: number[] } // 0 = Monday ... 6 = Sunday

const PLANS: Plan[] = [
  { id: 'vocabulario', title: 'Estudar vocabulário todos os dias', task: 'Revisar 20 cartões no Anki', days: [0, 1, 2, 3, 4] },
  { id: 'conversacao', title: 'Praticar conversação', task: 'Ouvir podcast em inglês no trajeto', days: [1, 3, 5] },
]

/**
 * Made-up data for the presentation demo, for the current week in Brasília:
 * the days before today are done (see MIN_DONE), today is open, and every
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
    // The days before today are done; early in the week there are none, so the earliest other
    // tasks stand in, so that every goal has some progress for the cards to animate.
    const done = new Set(offsets.filter((offset) => offset < todayOffset))
    for (const offset of offsets) {
      if (done.size >= MIN_DONE) break
      if (offset !== todayOffset) done.add(offset)
    }
    const dailyTasks = offsets.map((offset): DailyTask => {
      const date = addAppDays(weekStart, offset)
      const completed = done.has(offset)
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

  const weeks = PAST_RATES.map((rate, index): DemoWeek => ({
    weekStart: addAppWeeks(weekStart, index - PAST_RATES.length),
    rate,
  }))

  return { today, objective, goals, weeks }
}
