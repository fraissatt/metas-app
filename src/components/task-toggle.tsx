'use client'

import { useTransition } from 'react'
import { Checkbox } from '@/components/ui/checkbox'

export function TaskToggle({
  taskId,
  completed,
  action,
}: {
  taskId: string
  completed: boolean
  action: (id: string) => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Checkbox
      checked={completed}
      disabled={isPending}
      onCheckedChange={() => startTransition(() => action(taskId))}
    />
  )
}
