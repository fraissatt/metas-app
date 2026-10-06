'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LeaveGuestDialog } from '@/components/leave-guest-dialog'

export function GuestBanner({ onCreateAccount }: { onCreateAccount: () => Promise<void> }) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div role="status" className="border-b border-border bg-secondary text-secondary-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm md:px-8">
        <p className="flex-1">Você está como visitante. Os dados somem após 24 h sem uso.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => setConfirmOpen(true)}>
          Criar conta
        </Button>
      </div>
      <LeaveGuestDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        action={onCreateAccount}
        confirmLabel="Continuar"
        toSignUp
      />
    </div>
  )
}
