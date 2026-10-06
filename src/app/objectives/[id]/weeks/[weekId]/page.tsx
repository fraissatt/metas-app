import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getObjective } from '@/lib/actions/objectives'
import { deleteWeeklyGoal, getWeeklyGoal } from '@/lib/actions/weeklyGoals'
import {
  createDailyTasks,
  deleteDailyTask,
  listDailyTasksByWeeklyGoal,
  toggleDailyTask,
  updateDailyTask,
} from '@/lib/actions/dailyTasks'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WeeklyGoalDayChart } from '@/components/weekly-goal-day-chart'
import { WeeklyGoalTasks } from '@/components/weekly-goal-tasks'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; weekId: string }>
}): Promise<Metadata> {
  const { weekId } = await params
  const goal = await getWeeklyGoal(weekId)
  return { title: goal?.title ?? 'Meta semanal' }
}

export default async function WeeklyGoalDetailPage({
  params,
}: {
  params: Promise<{ id: string; weekId: string }>
}) {
  const { id, weekId } = await params
  const goal = await getWeeklyGoal(weekId)
  if (!goal || goal.objectiveId !== id) notFound()
  const objective = await getObjective(id)
  if (!objective) notFound()

  const dailyTasks = await listDailyTasksByWeeklyGoal(weekId)

  async function addTasks(formData: FormData) {
    'use server'
    await createDailyTasks(weekId, formData)
  }

  // This page would 404 once its goal is gone, so leave for the objective.
  async function removeGoal() {
    'use server'
    await deleteWeeklyGoal(weekId)
    redirect(`/objectives/${id}`)
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Breadcrumbs
        items={[
          { label: 'Objetivos', href: '/objectives' },
          { label: objective.title, href: `/objectives/${id}` },
          { label: goal.title },
        ]}
      />
      <div className="mb-6 flex flex-col items-start gap-2">
        <h1 className="text-2xl font-semibold break-words">{goal.title}</h1>
        {goal.recurring && (
          <span className="rounded-full bg-support-muted px-2 py-0.5 text-[11px] font-medium text-support-foreground">
            repete toda semana
          </span>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <WeeklyGoalTasks
          goal={{ ...goal, dailyTasks }}
          onCreateTasks={addTasks}
          onDelete={removeGoal}
          onToggleTask={toggleDailyTask}
          onUpdateTask={updateDailyTask}
          onDeleteTask={deleteDailyTask}
        />

        {/* What sets this page apart from the card: the per-day view is always open. */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Por dia</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyGoalDayChart weekStart={goal.weekStart} tasks={dailyTasks} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
