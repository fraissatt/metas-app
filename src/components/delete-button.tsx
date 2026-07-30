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
  DialogTrigger,
} from '@/components/ui/dialog'

export function DeleteButton({
  action,
  label = 'Excluir',
  confirmDescription = 'Esta ação não pode ser desfeita.',
}: {
  action: () => Promise<void>
  label?: string
  /** Customize to warn about cascade-deleted children (e.g. weekly goals, daily tasks). */
  confirmDescription?: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="destructive" disabled={isPending} />}>
        {label}
      </DialogTrigger>
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
