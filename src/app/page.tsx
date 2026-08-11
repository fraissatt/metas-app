import { listDailyTasksByDate, toggleDailyTask } from '@/lib/actions/dailyTasks'
import { listWeeklyGoalsForCurrentWeek } from '@/lib/actions/weeklyGoals'
import { FluidDayWeek } from '@/components/fluid-day-week'

// This page's correctness depends on the wall clock at request time (it
// filters tasks by "today" and computes "the current week" from `new
// Date()`), so it must never be statically prerendered — otherwise it freezes on the build day/week forever.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const tasks = await listDailyTasksByDate(new Date())
  const goals = await listWeeklyGoalsForCurrentWeek()

  return (
    <main className="mx-auto max-w-2xl p-8 lg:max-w-6xl">
      <FluidDayWeek tasks={tasks} goals={goals} onToggleTask={toggleDailyTask} />
    </main>
  )
}
