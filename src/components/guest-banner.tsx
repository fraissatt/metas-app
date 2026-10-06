'use client'

import { Button } from '@/components/ui/button'
import { runRedirectingAction } from '@/lib/run-redirecting-action'

export function GuestBanner({ onCreateAccount }: { onCreateAccount: () => Promise<void> }) {
  return (
    <div role="status" className="border-b border-border bg-secondary text-secondary-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm md:px-8">
        <p className="flex-1">Você está como visitante. Os dados somem após 24 h sem uso.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void runRedirectingAction(onCreateAccount)}>
          Criar conta
        </Button>
      </div>
    </div>
  )
}
