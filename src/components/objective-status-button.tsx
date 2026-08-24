'use client'

import { useTransition } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import type { Status } from '@prisma/client'
import { Button } from '@/components/ui/button'

export function ObjectiveStatusButton({
  status,
  onComplete,
  onReopen,
}: {
  status: Status
  onComplete: () => Promise<void>
  onReopen: () => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()
  const isCompleted = status === 'COMPLETED'

  // No confirmation dialog: the action is undone by this same button, and
  // asking "are you sure?" before a celebration sours it.
  return (
    <Button
      type="button"
      variant={isCompleted ? 'secondary' : 'default'}
      disabled={isPending}
      onClick={() => startTransition(() => (isCompleted ? onReopen() : onComplete()))}
    >
      {isCompleted ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
      {isCompleted ? 'Reabrir' : 'Concluir objetivo'}
    </Button>
  )
}
