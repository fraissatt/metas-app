'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * A submit button that stays enabled until the request actually starts, then
 * shows a spinner next to its original label so a slow save never looks
 * ignored. Must be rendered inside the `<form>` it submits.
 */
export function SubmitButton({
  children,
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'type'>) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
      {children}
    </Button>
  )
}
