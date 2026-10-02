import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createObjective } from '@/lib/actions/objectives'
import { ObjectiveForm } from '@/components/objective-form'
import { Breadcrumbs } from '@/components/breadcrumbs'

export const metadata: Metadata = { title: 'Novo objetivo' }

export default function NewObjectivePage() {
  async function action(formData: FormData) {
    'use server'
    await createObjective(formData)
    redirect('/objectives')
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <Breadcrumbs items={[{ label: 'Objetivos', href: '/objectives' }, { label: 'Novo objetivo' }]} />
      <h1 className="mb-6 text-2xl font-semibold">Novo objetivo</h1>
      <ObjectiveForm action={action} />
    </main>
  )
}
