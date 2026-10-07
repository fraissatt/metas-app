import { addAppDays, addAppWeeks, appToday, atAppHour, differenceInAppDays, getWeekBounds, isSameAppDay } from '@/lib/dates'

export type DemoTask = { title: string; date: Date; completed: boolean; completedAt: Date | null }
export type DemoGoal = { title: string; weekStart: Date; weekEnd: Date; recurring: boolean; tasks: DemoTask[] }
export type DemoObjective = {
  title: string
  startDate: Date
  targetDate: Date
  status: 'ACTIVE' | 'COMPLETED'
  completedAt: Date | null
  goals: DemoGoal[]
}

type Plan = {
  goal: string
  task: string
  days: number[] // 0 = Monday … 6 = Sunday
  rates: number[] // completion per past week, oldest first
  recurring: boolean
}

// Fixed patterns, not randomness: every guest sees the same believable story,
// and tests can rely on it.
const RUN: Plan = { goal: 'Treinar 3x na semana', task: 'Corrida leve', days: [0, 2, 4], rates: [1, 1, 0.67, 1, 1, 0.33, 1], recurring: true }
const READ: Plan = { goal: 'Ler 20 páginas por dia', task: 'Ler 20 páginas', days: [0, 1, 2, 3, 4], rates: [0.8, 1, 1, 0.6, 1, 0.8, 1], recurring: true }
const GUITAR: Plan = { goal: 'Praticar acordes', task: 'Praticar 20 min', days: [1, 3, 5], rates: [1, 1, 0.67, 1, 1, 1, 1, 1], recurring: false }

function week(weekStart: Date, plan: Plan, rate: number | 'current', now: Date): DemoGoal {
  const { weekEnd } = getWeekBounds(weekStart)
  const today = appToday(now)
  const doneCount = rate === 'current' ? 0 : Math.round(rate * plan.days.length)

  const tasks = plan.days.map((offset, index): DemoTask => {
    const date = addAppDays(weekStart, offset)
    let completed: boolean
    if (rate === 'current') {
      // Past days of this week are done; today is done only for reading, so Hoje shows one open and one checked.
      completed = differenceInAppDays(today, date) > 0 || (isSameAppDay(date, today) && plan === READ)
    } else {
      completed = index < doneCount
    }
    const completedAt = completed ? (isSameAppDay(date, today) ? now : atAppHour(date, 19)) : null
    return { title: plan.task, date, completed, completedAt }
  })

  return { title: plan.goal, weekStart, weekEnd, recurring: plan.recurring, tasks }
}

function weeksOf(plan: Plan, firstWeek: Date, now: Date, includeCurrent: boolean): DemoGoal[] {
  const goals = plan.rates.map((rate, i) => week(addAppWeeks(firstWeek, i), plan, rate, now))
  if (includeCurrent) goals.push(week(addAppWeeks(firstWeek, plan.rates.length), plan, 'current', now))
  return goals
}

export function buildDemoData(now: Date): DemoObjective[] {
  const current = getWeekBounds(now).weekStart
  const sevenAgo = addAppWeeks(current, -7)
  const tenAgo = addAppWeeks(current, -10)

  return [
    {
      title: 'Correr 10 km',
      startDate: sevenAgo,
      // The race is close: this is the objective near its target date.
      targetDate: addAppDays(appToday(now), 10),
      status: 'ACTIVE',
      completedAt: null,
      goals: weeksOf(RUN, sevenAgo, now, true),
    },
    {
      title: 'Ler 4 livros em 4 meses',
      startDate: sevenAgo,
      // Under half of the deadline gone after 7 weeks, so the pace looks believable.
      targetDate: addAppWeeks(sevenAgo, 17),
      status: 'ACTIVE',
      completedAt: null,
      goals: weeksOf(READ, sevenAgo, now, true),
    },
    {
      title: 'Aprender o básico de violão',
      startDate: tenAgo,
      targetDate: addAppWeeks(current, -2),
      status: 'COMPLETED',
      completedAt: atAppHour(addAppDays(addAppWeeks(current, -3), 5), 18),
      goals: weeksOf(GUITAR, tenAgo, now, false),
    },
  ]
}
