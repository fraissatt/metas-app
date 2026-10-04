'use client'

import { useEffect, useState, useTransition, type RefObject } from 'react'
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

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  action,
  label = 'Excluir',
  confirmDescription = 'Esta ação não pode ser desfeita.',
  onPendingChange,
  finalFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: () => Promise<void>
  label?: string
  /** Customize to warn about cascade-deleted children (e.g. weekly goals, daily tasks). */
  confirmDescription?: string
  /** Reports whether the confirmed action is still running. */
  onPendingChange?: (pending: boolean) => void
  /** Element to focus after the dialog closes. */
  finalFocus?: RefObject<HTMLElement | null>
}) {
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    onPendingChange?.(isPending)
  }, [isPending, onPendingChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>Confirmar exclusão</DialogTitle>
          <DialogDescription>{confirmDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
          <DialogClose
            render={
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={() => startTransition(() => action())}
              />
            }
          >
            {label}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteButton({
  action,
  label = 'Excluir',
  confirmDescription,
}: {
  action: () => Promise<void>
  label?: string
  confirmDescription?: string
}) {
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        disabled={isPending}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <DeleteConfirmDialog
        open={open}
        onOpenChange={setOpen}
        action={action}
        label={label}
        confirmDescription={confirmDescription}
        onPendingChange={setIsPending}
      />
    </>
  )
}
