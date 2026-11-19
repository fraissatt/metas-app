'use client'

import { useTransition } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import type { Status } from '@prisma/client'
import { PendingButton } from '@/components/pending-button'

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
    <PendingButton
      type="button"
      variant={isCompleted ? 'secondary' : 'default'}
      pending={isPending}
      icon={isCompleted ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
      onClick={() => startTransition(() => (isCompleted ? onReopen() : onComplete()))}
    >
      {isCompleted ? 'Reabrir' : 'Concluir objetivo'}
    </PendingButton>
  )
}
