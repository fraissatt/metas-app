'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/submit-button'

export function DailyTaskForm({
  action,
  defaultValues,
}: {
  action: (formData: FormData) => Promise<void>
  defaultValues?: { title: string; date: string }
}) {
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          name="title"
          required
          autoComplete="off"
          placeholder="Ex.: Treino de 5 km…"
          defaultValue={defaultValues?.title}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="date">Data</Label>
        <Input id="date" name="date" type="date" required defaultValue={defaultValues?.date} />
      </div>
      <SubmitButton className="sm:w-auto">{defaultValues ? 'Salvar' : 'Adicionar'}</SubmitButton>
    </form>
  )
}
