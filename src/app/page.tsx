import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { deleteDailyTask, listDailyTasksByDate, toggleDailyTask, updateDailyTask } from '@/lib/actions/dailyTasks'
import { countObjectives } from '@/lib/actions/objectives'
import { enterAsGuest } from '@/lib/actions/guest'
import { getDayDots, getLifetimeStats } from '@/lib/actions/stats'
import { getWeekReviewInvite } from '@/lib/actions/weekReview'
import {
  countPendingRecurrences,
  getMissingGoalsPreview,
  listWeeklyGoalsForCurrentWeek,
  materializePendingWeek,
  repeatMissingGoals,
} from '@/lib/actions/weeklyGoals'
import { getCurrentUser } from '@/lib/session'
import { FluidDayWeek } from '@/components/fluid-day-week'
import { HomeEmptyState } from '@/components/home-empty-state'
import { Landing } from '@/components/landing'
import { LifetimeProgressBanner } from '@/components/lifetime-progress-banner'
import { MissingGoalsCard } from '@/components/missing-goals-card'
import { ReturnEmptyState } from '@/components/return-empty-state'
import { SmallStepsSection } from '@/components/small-steps-section'
import { WeekMaterializer } from '@/components/week-materializer'
import { WeekReviewInvite } from '@/components/week-review-invite'

// The layout's title template skips pages in its own segment, so spell it out.
// The title depends on the session: signed-out visitors see the presentation page.
export async function generateMetadata(): Promise<Metadata> {
  if (await getCurrentUser()) return { title: { absolute: 'Hoje · Metas' } }
  return {
    title: { absolute: 'Metas · Do objetivo à tarefa do dia' },
    description: 'Objetivos, metas semanais e tarefas diárias em um só lugar. Entre como visitante e teste agora.',
  }
}

// This page's correctness depends on the wall clock at request time (it
// filters tasks by "today" and computes "the current week" from `new
// Date()`), so it must never be statically prerendered — otherwise it freezes on the build day/week forever.
export const dynamic = 'force-dynamic'

export default async function Home() {
  // Signed-out visitors (and expired cookies) get the presentation page.
  if (!(await getCurrentUser())) return <Landing onEnterAsGuest={enterAsGuest} />

  const goals = await listWeeklyGoalsForCurrentWeek()
  const stats = await getLifetimeStats()
  const reviewInvite = await getWeekReviewInvite()
  // While the review is due it is the one place to decide what continues;
  // "Ficou para trás" would offer the same week's goals as a competing action.
  const preview = reviewInvite ? null : await getMissingGoalsPreview()
  // A read, never a write. The write happens in the effect below, because
  // Next prefetches the header and bottom-bar links to "/" and a mutation here would run
  // on hover.
  const pendingRecurrences = await countPendingRecurrences()

  const banner = stats.totalCompleted > 0 ? <LifetimeProgressBanner {...stats} /> : null
  const invite = reviewInvite ? <WeekReviewInvite invite={reviewInvite} /> : null
  const materializer =
    pendingRecurrences > 0 ? <WeekMaterializer onMaterialize={materializePendingWeek} /> : null

  // S3 — the week is planned. The only branch that needs today's tasks.
  if (goals.length > 0) {
    const tasks = await listDailyTasksByDate(new Date())
    const dayDots = await getDayDots()

    return (
      <main className="mx-auto max-w-2xl p-8 lg:max-w-6xl">
        {materializer}
        {banner}
        {invite}
        <FluidDayWeek
          tasks={tasks}
          goals={goals}
          onToggleTask={toggleDailyTask}
          onUpdateTask={updateDailyTask}
          onDeleteTask={deleteDailyTask}
        />
        {preview && (
          <div className="mt-6 max-w-md">
            <MissingGoalsCard preview={preview} onRepeat={repeatMissingGoals} />
          </div>
        )}
        <SmallStepsSection data={dayDots} />
      </main>
    )
  }

  // S1 — nothing exists yet. Neither banner nor materialiser can apply. A
  // read-only redirect (safe under prefetch) to the onboarding quiz.
  if ((await countObjectives()) === 0) redirect('/quiz')

  // S2 when something can be brought forward, S2b when nothing can. A pending
  // recurrence is often exactly why this week is still empty, so the
  // materialiser belongs here too. The small steps section shows here as
  // well, so a new user sees what each day done builds toward instead of an
  // empty screen.
  const dayDots = await getDayDots()

  return (
    <main className="mx-auto max-w-2xl p-8">
      {materializer}
      {banner}
      {invite}
      {preview ? (
        <ReturnEmptyState preview={preview} onRepeat={repeatMissingGoals} />
      ) : (
        <HomeEmptyState variant="no-goal" />
      )}
      <SmallStepsSection data={dayDots} />
    </main>
  )
}
