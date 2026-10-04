'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/submit-button'

export function WeeklyGoalForm({
  action,
  defaultValues,
  autoFocusTitle,
}: {
  action: (formData: FormData) => Promise<void>
  defaultValues?: { title: string; weekOf: string; recurring?: boolean }
  autoFocusTitle?: boolean
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          name="title"
          required
          autoFocus={autoFocusTitle}
          autoComplete="off"
          placeholder="Ex.: Correr 3 vezes…"
          defaultValue={defaultValues?.title}
        />
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
      {/* Wrapping label: the checkbox and its text share one hit target. */}
      <Label className="w-fit cursor-pointer font-normal">
        <Checkbox name="recurring" defaultChecked={defaultValues?.recurring} />
        Repetir toda semana
      </Label>
      <SubmitButton>Salvar</SubmitButton>
    </form>
  )
}
