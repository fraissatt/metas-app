import { notFound } from 'next/navigation'
import { getObjective } from '@/lib/actions/objectives'
import { getObjectiveProgressSeries } from '@/lib/actions/progress'
import { createDailyTasks } from '@/lib/actions/dailyTasks'
import { createWeeklyGoal, deleteWeeklyGoal, listWeeklyGoalsByObjective } from '@/lib/actions/weeklyGoals'
import { ObjectiveProgressChart } from '@/components/objective-progress-chart'
import { WeeklyGoalsPanel } from '@/components/weekly-goals-panel'

export default async function ObjectiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const objective = await getObjective(id)
  if (!objective) notFound()

  const weeklyGoals = await listWeeklyGoalsByObjective(id)
  const series = await getObjectiveProgressSeries(id)

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold break-words">{objective.title}</h1>
      <div className="mb-6">
        <ObjectiveProgressChart data={series} />
      </div>
      <WeeklyGoalsPanel
        goals={weeklyGoals}
        onCreateTasks={createDailyTasks}
        onCreateWeeklyGoal={createWeeklyGoal.bind(null, id)}
        onDeleteWeeklyGoal={deleteWeeklyGoal}
      />
    </main>
  )
}
