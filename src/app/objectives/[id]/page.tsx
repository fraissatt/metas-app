import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import {
  completeObjective,
  getObjective,
  getObjectiveStats,
  reopenObjective,
} from '@/lib/actions/objectives'
import { getObjectiveProgressSeries } from '@/lib/actions/progress'
import { createDailyTasks } from '@/lib/actions/dailyTasks'
import { createWeeklyGoal, deleteWeeklyGoal, listWeeklyGoalsByObjective } from '@/lib/actions/weeklyGoals'
import { describeSchedule } from '@/lib/objectives'
import { ObjectiveProgressChart } from '@/components/objective-progress-chart'
import { ObjectiveStatsPanel } from '@/components/objective-stats'
import { ObjectiveStatusButton } from '@/components/objective-status-button'
import { WeeklyGoalsPanel } from '@/components/weekly-goals-panel'

export default async function ObjectiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const objective = await getObjective(id)
  if (!objective) notFound()

  const weeklyGoals = await listWeeklyGoalsByObjective(id)
  const series = await getObjectiveProgressSeries(id)
  const stats = await getObjectiveStats(id)
  const schedule = objective.completedAt
    ? describeSchedule(objective.completedAt, objective.targetDate)
    : null

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 text-2xl font-semibold break-words">{objective.title}</h1>
        <ObjectiveStatusButton
          status={objective.status}
          onComplete={completeObjective.bind(null, id)}
          onReopen={reopenObjective.bind(null, id)}
        />
      </div>

      <div className="mb-6">
        <ObjectiveStatsPanel stats={stats} />
        {objective.completedAt && (
          <p className="mt-2 text-sm font-medium text-primary">
            ✓ Concluído em {format(objective.completedAt, 'dd/MM/yyyy')}
            {schedule ? ` · ${schedule}` : ''}
          </p>
        )}
      </div>

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
