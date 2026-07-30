'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function WeeklyGoalForm({
  action,
  defaultValues,
}: {
  action: (formData: FormData) => Promise<void>
  defaultValues?: { title: string; weekOf: string }
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" required defaultValue={defaultValues?.title} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="weekOf">Semana de</Label>
        <Input
          id="weekOf"
          name="weekOf"
          type="date"
          required
          defaultValue={defaultValues?.weekOf}
        />
      </div>
      <Button type="submit">Salvar</Button>
    </form>
  )
}
