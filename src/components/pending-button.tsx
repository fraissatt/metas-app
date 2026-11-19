import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * A button for an action that talks to the server. While `pending` it is
 * disabled (no double save), marked busy, and a spinner takes the place of its
 * `icon`, so a slow request never looks ignored. The label stays put.
 */
export function PendingButton({
  pending,
  icon,
  disabled,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { pending: boolean; icon?: ReactNode }) {
  return (
    <Button disabled={pending || disabled} aria-busy={pending || undefined} {...props}>
      {pending ? (
        <Loader2 data-testid="spinner" aria-hidden="true" className="size-4 motion-safe:animate-spin" />
      ) : (
        icon
      )}
      {children}
    </Button>
  )
}
