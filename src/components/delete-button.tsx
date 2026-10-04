'use client'

import { useState, useTransition } from 'react'
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: () => Promise<void>
  label?: string
  /** Customize to warn about cascade-deleted children (e.g. weekly goals, daily tasks). */
  confirmDescription?: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
  const [isPending, startTransition] = useTransition()

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
        action={() => {
          startTransition(() => {
            void action()
          })
          return Promise.resolve()
        }}
        label={label}
        confirmDescription={confirmDescription}
      />
    </>
  )
}
