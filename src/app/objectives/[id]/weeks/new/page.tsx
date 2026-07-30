import { redirect } from 'next/navigation'
import { createWeeklyGoal } from '@/lib/actions/weeklyGoals'
import { WeeklyGoalForm } from '@/components/weekly-goal-form'

export default function NewWeeklyGoalPage({ params }: { params: Promise<{ id: string }> }) {
  async function action(formData: FormData) {
    'use server'
    const { id } = await params
    await createWeeklyGoal(id, formData)
    redirect(`/objectives/${id}`)
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">Nova meta semanal</h1>
      <WeeklyGoalForm action={action} />
    </main>
  )
}
