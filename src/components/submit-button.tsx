'use client'

import { useFormStatus } from 'react-dom'
import { PendingButton } from '@/components/pending-button'
import type { Button } from '@/components/ui/button'

/**
 * A submit button that stays enabled until the request actually starts, then
 * shows a spinner next to its original label so a slow save never looks
 * ignored. Must be rendered inside the `<form>` it submits.
 */
export function SubmitButton(props: Omit<React.ComponentProps<typeof Button>, 'type'>) {
  const { pending } = useFormStatus()

  return <PendingButton type="submit" pending={pending} {...props} />
}
