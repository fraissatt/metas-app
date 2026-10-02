'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/submit-button'

export function ObjectiveForm({
  action,
  defaultValues,
}: {
  action: (formData: FormData) => Promise<void>
  defaultValues?: {
    title: string
    description?: string | null
    startDate: string
    targetDate?: string | null
  }
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          name="title"
          required
          autoComplete="off"
          placeholder="Ex.: Correr uma meia maratona…"
          defaultValue={defaultValues?.title}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Input
          id="description"
          name="description"
          autoComplete="off"
          placeholder="Por que isso importa para você…"
          defaultValue={defaultValues?.description ?? ''}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="startDate">Início</Label>
        <Input
          id="startDate"
          name="startDate"
          type="date"
          required
          defaultValue={defaultValues?.startDate}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="targetDate">Meta para</Label>
        <Input
          id="targetDate"
          name="targetDate"
          type="date"
          defaultValue={defaultValues?.targetDate ?? ''}
        />
      </div>
      <SubmitButton>Salvar</SubmitButton>
    </form>
  )
}
