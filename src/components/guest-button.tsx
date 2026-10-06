'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function GuestButton({ onEnter }: { onEnter: () => Promise<void> }) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setFailed(false)
          try {
            // A redirect() inside the Server Action is applied by Next's router
            // and the awaited promise resolves; only real failures reject.
            // Stay pending on success: the page is navigating away.
            await onEnter()
          } catch {
            setFailed(true)
            setPending(false)
          }
        }}
      >
        Entrar como visitante
      </Button>
      <p className="text-xs text-muted-foreground">Conta de demonstração com dados prontos</p>
      {failed && <p role="alert" className="text-xs text-destructive">Não foi possível concluir. Tente de novo.</p>}
    </div>
  )
}
