import { redirect } from 'next/navigation'
import { createObjective } from '@/lib/actions/objectives'
import { ObjectiveForm } from '@/components/objective-form'

export default function NewObjectivePage() {
  async function action(formData: FormData) {
    'use server'
    await createObjective(formData)
    redirect('/objectives')
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">Novo objetivo</h1>
      <ObjectiveForm action={action} />
    </main>
  )
}
