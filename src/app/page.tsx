import { listDailyTasksByDate, toggleDailyTask } from '@/lib/actions/dailyTasks'
import { getLifetimeStats } from '@/lib/actions/stats'
import { listWeeklyGoalsForCurrentWeek } from '@/lib/actions/weeklyGoals'
import { FluidDayWeek } from '@/components/fluid-day-week'
import { LifetimeProgressBanner } from '@/components/lifetime-progress-banner'

// This page's correctness depends on the wall clock at request time (it
// filters tasks by "today" and computes "the current week" from `new
// Date()`), so it must never be statically prerendered — otherwise it freezes on the build day/week forever.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const tasks = await listDailyTasksByDate(new Date())
  const goals = await listWeeklyGoalsForCurrentWeek()
  const stats = await getLifetimeStats()

  return (
    <main className="mx-auto max-w-2xl p-8 lg:max-w-6xl">
      {/* Full-width, above the two-column layout rather than inside either
          column: the right column collapses into an accordion below `lg`, and
          the accumulated total has to stay visible on a phone — that is the
          screen a returning user opens. */}
      {stats.totalCompleted > 0 && <LifetimeProgressBanner {...stats} />}
      <FluidDayWeek tasks={tasks} goals={goals} onToggleTask={toggleDailyTask} />
    </main>
  )
}
