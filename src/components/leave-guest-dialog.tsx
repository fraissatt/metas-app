'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { runRedirectingAction } from '@/lib/run-redirecting-action'

// A guest has no e-mail or password: once signed out, that account and its
// data can't be reached again, so leaving it always asks first.
export function LeaveGuestDialog({
  open,
  onOpenChange,
  action,
  confirmLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: () => Promise<void>
  confirmLabel: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sair da conta de visitante?</DialogTitle>
          <DialogDescription>Seus dados de visitante serão perdidos.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => startTransition(() => runRedirectingAction(action))}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
