import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getObjective } from '@/lib/actions/objectives'
import { getWeeklyGoal } from '@/lib/actions/weeklyGoals'
import { createDailyTask, deleteDailyTask, listDailyTasksByWeeklyGoal, toggleDailyTask } from '@/lib/actions/dailyTasks'
import { DailyTaskForm } from '@/components/daily-task-form'
import { TaskToggle } from '@/components/task-toggle'
import { DeleteButton } from '@/components/delete-button'
import { Button } from '@/components/ui/button'
import { Breadcrumbs } from '@/components/breadcrumbs'

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

  const tasks = await listDailyTasksByWeeklyGoal(weekId)

  async function addTask(formData: FormData) {
    'use server'
    await createDailyTask(weekId, formData)
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
      <h1 className="mb-6 text-2xl font-semibold break-words">{goal.title}</h1>
      <DailyTaskForm action={addTask} />
      {tasks.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">Nenhuma tarefa ainda. Adicione a primeira acima.</p>
      )}
      <ul className="mt-6 flex flex-col gap-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3"
          >
            <label className="flex min-w-0 cursor-pointer items-start gap-3">
              <TaskToggle taskId={task.id} completed={task.completed} action={toggleDailyTask} />
              <span
                className={`min-w-0 break-words ${task.completed ? 'line-through text-muted-foreground' : ''}`}
              >
                {task.title}
              </span>
            </label>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="secondary"
                nativeButton={false}
                render={<Link href={`/objectives/${id}/weeks/${weekId}/tasks/${task.id}/edit`} />}
              >
                Editar
              </Button>
              <DeleteButton action={deleteDailyTask.bind(null, task.id)} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
