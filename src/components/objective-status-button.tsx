'use client'

import { useTransition } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import type { Status } from '@prisma/client'
import { MomentToast, useMoment } from '@/components/moment-toast'
import { PendingButton } from '@/components/pending-button'
import { objectiveMoment } from '@/lib/moments'

export function ObjectiveStatusButton({
  status,
  title,
  onComplete,
  onReopen,
}: {
  status: Status
  /** The objective's title, named in the note shown when it is completed. */
  title?: string
  onComplete: () => Promise<void>
  onReopen: () => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()
  const isCompleted = status === 'COMPLETED'
  const { moment, onDone, celebrate } = useMoment()

  function run() {
    startTransition(async () => {
      if (isCompleted) {
        await onReopen()
        return
      }
      await onComplete()
      // Only after it was saved: a failed save must not be celebrated.
      celebrate(objectiveMoment(title))
    })
  }

  // No confirmation dialog: the action is undone by this same button, and
  // asking "are you sure?" before a celebration sours it.
  return (
    <>
      <MomentToast moment={moment} onDone={onDone} />
      <PendingButton
        type="button"
        variant={isCompleted ? 'secondary' : 'default'}
        pending={isPending}
        icon={isCompleted ? <RotateCcw className="size-4" /> : <Check className="size-4" />}
        onClick={run}
      >
        {isCompleted ? 'Reabrir' : 'Concluir objetivo'}
      </PendingButton>
    </>
  )
}
