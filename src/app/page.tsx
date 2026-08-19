import { listDailyTasksByDate, toggleDailyTask } from '@/lib/actions/dailyTasks'
import { countObjectives } from '@/lib/actions/objectives'
import { getLifetimeStats } from '@/lib/actions/stats'
import {
  getMissingGoalsPreview,
  listWeeklyGoalsForCurrentWeek,
  repeatMissingGoals,
} from '@/lib/actions/weeklyGoals'
import { FluidDayWeek } from '@/components/fluid-day-week'
import { HomeEmptyState } from '@/components/home-empty-state'
import { LifetimeProgressBanner } from '@/components/lifetime-progress-banner'
import { MissingGoalsCard } from '@/components/missing-goals-card'
import { ReturnEmptyState } from '@/components/return-empty-state'

// This page's correctness depends on the wall clock at request time (it
// filters tasks by "today" and computes "the current week" from `new
// Date()`), so it must never be statically prerendered — otherwise it freezes on the build day/week forever.
export const dynamic = 'force-dynamic'

export default async function Home() {
  const goals = await listWeeklyGoalsForCurrentWeek()
  const stats = await getLifetimeStats()
  // Fetched before the branch, not inside it: S3 needs it too, to offer goals
  // that were left behind even though the week is not empty.
  const preview = await getMissingGoalsPreview()

  // Rendered above every state that has any history behind it, so the
  // accumulated total is the first thing a returning user sees.
  const banner = stats.totalCompleted > 0 ? <LifetimeProgressBanner {...stats} /> : null

  // S3 — the week is planned. The only branch that needs today's tasks.
  if (goals.length > 0) {
    const tasks = await listDailyTasksByDate(new Date())

    return (
      <main className="mx-auto max-w-2xl p-8 lg:max-w-6xl">
        {banner}
        <FluidDayWeek tasks={tasks} goals={goals} onToggleTask={toggleDailyTask} />
        {preview && (
          <div className="mt-6">
            <MissingGoalsCard preview={preview} onRepeat={repeatMissingGoals} />
          </div>
        )}
      </main>
    )
  }

  // S1 — nothing exists yet. `banner` is necessarily null here.
  if ((await countObjectives()) === 0) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <HomeEmptyState variant="no-objective" />
      </main>
    )
  }

  // S2 when something can be brought forward, S2b when nothing can.
  return (
    <main className="mx-auto max-w-2xl p-8">
      {banner}
      {preview ? (
        <ReturnEmptyState preview={preview} onRepeat={repeatMissingGoals} />
      ) : (
        <HomeEmptyState variant="no-goal" />
      )}
    </main>
  )
}
