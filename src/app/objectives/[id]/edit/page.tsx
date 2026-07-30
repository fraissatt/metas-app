import { format } from 'date-fns'
import { notFound, redirect } from 'next/navigation'
import { getObjective, updateObjective } from '@/lib/actions/objectives'
import { ObjectiveForm } from '@/components/objective-form'

export default async function EditObjectivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const objective = await getObjective(id)
  if (!objective) notFound()

  async function action(formData: FormData) {
    'use server'
    await updateObjective(id, formData)
    redirect('/objectives')
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">Editar objetivo</h1>
      <ObjectiveForm
        action={action}
        defaultValues={{
          title: objective.title,
          description: objective.description,
          startDate: format(objective.startDate, 'yyyy-MM-dd'),
          targetDate: objective.targetDate ? format(objective.targetDate, 'yyyy-MM-dd') : null,
        }}
      />
    </main>
  )
}
