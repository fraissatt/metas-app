import type { Metadata } from 'next'
import { format } from 'date-fns'
import { notFound, redirect } from 'next/navigation'
import { getDailyTask, updateDailyTask } from '@/lib/actions/dailyTasks'
import { DailyTaskForm } from '@/components/daily-task-form'

export const metadata: Metadata = { title: 'Editar tarefa' }

export default async function EditDailyTaskPage({
  params,
}: {
  params: Promise<{ id: string; weekId: string; taskId: string }>
}) {
  const { id, weekId, taskId } = await params
  const task = await getDailyTask(taskId)
  if (!task) notFound()

  async function action(formData: FormData) {
    'use server'
    await updateDailyTask(taskId, formData)
    redirect(`/objectives/${id}/weeks/${weekId}`)
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">Editar tarefa</h1>
      <DailyTaskForm
        action={action}
        defaultValues={{ title: task.title, date: format(task.date, 'yyyy-MM-dd') }}
      />
    </main>
  )
}
