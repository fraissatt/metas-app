'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { WeeklyGoalForm } from '@/components/weekly-goal-form'

export function AddWeeklyGoalCard({
  onCreate,
  defaultOpen,
}: {
  onCreate: (formData: FormData) => Promise<void>
  defaultOpen?: boolean
}) {
  const [adding, setAdding] = useState(defaultOpen ?? false)

  if (!adding) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setAdding(true)}
        className="h-auto w-full border-dashed border-primary py-4 text-accent-foreground hover:bg-primary/10 hover:text-accent-foreground"
      >
        + Nova meta semanal
      </Button>
    )
  }

  async function handleCreate(formData: FormData) {
    await onCreate(formData)
    setAdding(false)
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <WeeklyGoalForm action={handleCreate} autoFocusTitle={defaultOpen} />
        <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
          Cancelar
        </Button>
      </CardContent>
    </Card>
  )
}
