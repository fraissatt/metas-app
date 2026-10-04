'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu } from '@base-ui/react/menu'
import { MoreHorizontal } from 'lucide-react'
import { DeleteConfirmDialog } from '@/components/delete-button'

const itemClass =
  'px-2 py-1.5 text-sm rounded-sm cursor-default outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground'

export function ObjectiveActionsMenu({
  objectiveId,
  onDelete,
}: {
  objectiveId: string
  onDelete: () => Promise<void>
}) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          ref={triggerRef}
          disabled={isPending}
          aria-label="Ações do objetivo"
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <MoreHorizontal className="size-4" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={4} className="z-50">
            <Menu.Popup className="bg-popover text-popover-foreground border border-border rounded-md p-1 shadow-md min-w-36">
              <Menu.Item
                className={itemClass}
                onClick={() => router.push(`/objectives/${objectiveId}/edit`)}
              >
                Editar
              </Menu.Item>
              <Menu.Item
                className={`${itemClass} text-destructive`}
                onClick={() => setConfirmOpen(true)}
              >
                Excluir…
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <DeleteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        action={onDelete}
        onPendingChange={setIsPending}
        finalFocus={triggerRef}
        confirmDescription="Isso também excluirá todas as metas semanais e tarefas diárias relacionadas. Esta ação não pode ser desfeita."
      />
    </>
  )
}
