'use client'

import { useState } from 'react'
import { Menu } from '@base-ui/react/menu'
import { CircleUser } from 'lucide-react'
import { LeaveGuestDialog } from '@/components/leave-guest-dialog'
import { runRedirectingAction } from '@/lib/run-redirecting-action'

const itemClass =
  'px-2 py-1.5 text-sm rounded-sm cursor-default outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground'

export function UserMenu({ name, isAnonymous, onSignOut }: { name: string; isAnonymous: boolean; onSignOut: () => Promise<void> }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const label = isAnonymous ? 'Visitante' : name

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          aria-label={`Conta: ${label}`}
          className="rounded-md px-2 py-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CircleUser className="size-5" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="end" sideOffset={4} className="z-50">
            <Menu.Popup className="bg-popover text-popover-foreground border border-border rounded-md p-1 shadow-md min-w-40">
              <p className="px-2 py-1.5 text-xs text-muted-foreground truncate">{label}</p>
              <Menu.Item
                className={itemClass}
                onClick={() => (isAnonymous ? setConfirmOpen(true) : void runRedirectingAction(onSignOut))}
              >
                Sair
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      {isAnonymous && (
        <LeaveGuestDialog open={confirmOpen} onOpenChange={setConfirmOpen} action={onSignOut} confirmLabel="Sair" />
      )}
    </>
  )
}
