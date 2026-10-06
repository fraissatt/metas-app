'use client'

import { useState } from 'react'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { Button } from '@/components/ui/button'
import { GUEST_THROTTLE_MESSAGE } from '@/lib/guest/throttle'

const GENERIC_ERROR = 'Não foi possível concluir. Tente de novo.'

export function GuestButton({ onEnter }: { onEnter: () => Promise<void> }) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setFailed(null)
          try {
            // In this Next version a redirect() inside the Server Action rejects
            // the awaited promise with a redirect error (the router navigates);
            // a plain resolve is also treated as success. Either way stay pending
            // because the page is navigating away. Only real failures show the error.
            await onEnter()
          } catch (error) {
            if (isRedirectError(error)) return
            // Only the throttle message is meant for users; never leak other server messages.
            setFailed(error instanceof Error && error.message === GUEST_THROTTLE_MESSAGE ? error.message : GENERIC_ERROR)
            setPending(false)
          }
        }}
      >
        Entrar como visitante
      </Button>
      <p className="text-xs text-muted-foreground">Conta de demonstração com dados prontos</p>
      {failed && <p role="alert" className="text-xs text-destructive">{failed}</p>}
    </div>
  )
}
