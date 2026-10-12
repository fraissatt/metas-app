import type { DailyTask, Objective, WeeklyGoal } from '@prisma/client'
import { addAppDays, addAppWeeks, appToday, differenceInAppDays, getWeekBounds } from '@/lib/dates'

export type DemoGoal = WeeklyGoal & { objective: Objective; dailyTasks: DailyTask[] }
/** `today` is the Brasília day the data was built for: the views read it instead of the clock, so server and client agree. */
export type LandingDemoData = { today: Date; objective: Objective; goals: DemoGoal[] }

type Plan = { id: string; title: string; task: string; days: number[] } // 0 = Monday ... 6 = Sunday

const PLANS: Plan[] = [
  { id: 'vocabulario', title: 'Estudar vocabulário todos os dias', task: 'Revisar 20 cartões no Anki', days: [0, 1, 2, 3, 4] },
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

  return { today, objective, goals }
}
