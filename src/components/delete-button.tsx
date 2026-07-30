'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'

export function DeleteButton({
  action,
  label = 'Excluir',
}: {
  action: () => Promise<void>
  label?: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="destructive"
      disabled={isPending}
      onClick={() => startTransition(() => action())}
    >
      {label}
    </Button>
  )
}
