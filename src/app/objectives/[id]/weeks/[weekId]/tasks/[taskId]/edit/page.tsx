import type { Metadata } from 'next'
import { formatDayKey } from '@/lib/dates'
import { notFound, redirect } from 'next/navigation'
import { getDailyTask, updateDailyTask } from '@/lib/actions/dailyTasks'
import { getObjective } from '@/lib/actions/objectives'
import { getWeeklyGoal } from '@/lib/actions/weeklyGoals'
import { DailyTaskForm } from '@/components/daily-task-form'
import { Breadcrumbs } from '@/components/breadcrumbs'

export const metadata: Metadata = { title: 'Editar tarefa' }

export default async function EditDailyTaskPage({
  params,
}: {
  params: Promise<{ id: string; weekId: string; taskId: string }>
}) {
  const { id, weekId, taskId } = await params
  const task = await getDailyTask(taskId)
  if (!task || task.weeklyGoalId !== weekId) notFound()
  const objective = await getObjective(id)
  if (!objective) notFound()
  const goal = await getWeeklyGoal(weekId)
  if (!goal || goal.objectiveId !== id) notFound()

  async function action(formData: FormData) {
    'use server'
    await updateDailyTask(taskId, formData)
    redirect(`/objectives/${id}/weeks/${weekId}`)
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <Breadcrumbs
        items={[
          { label: 'Objetivos', href: '/objectives' },
          { label: objective.title, href: `/objectives/${id}` },
          { label: goal.title, href: `/objectives/${id}/weeks/${weekId}` },
          { label: task.title },
          { label: 'Editar' },
        ]}
      />
      <h1 className="mb-6 text-2xl font-semibold">Editar tarefa</h1>
      <DailyTaskForm
        action={action}
        defaultValues={{ title: task.title, date: formatDayKey(task.date) }}
      />
    </main>
  )
}
