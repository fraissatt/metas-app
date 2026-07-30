'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
        <Input id="title" name="title" required defaultValue={defaultValues?.title} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="date">Data</Label>
        <Input id="date" name="date" type="date" required defaultValue={defaultValues?.date} />
      </div>
      <Button type="submit" className="sm:w-auto">
        {defaultValues ? 'Salvar' : 'Adicionar'}
      </Button>
    </form>
  )
}
