import { format } from 'date-fns'
import { notFound, redirect } from 'next/navigation'
import { getWeeklyGoal, updateWeeklyGoal } from '@/lib/actions/weeklyGoals'
import { WeeklyGoalForm } from '@/components/weekly-goal-form'

export default async function EditWeeklyGoalPage({
  params,
}: {
  params: Promise<{ id: string; weekId: string }>
}) {
  const { id, weekId } = await params
  const goal = await getWeeklyGoal(weekId)
  if (!goal) notFound()

  async function action(formData: FormData) {
    'use server'
    await updateWeeklyGoal(weekId, formData)
    redirect(`/objectives/${id}`)
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">Editar meta semanal</h1>
      <WeeklyGoalForm
        action={action}
        defaultValues={{ title: goal.title, weekOf: format(goal.weekStart, 'yyyy-MM-dd') }}
      />
    </main>
  )
}
