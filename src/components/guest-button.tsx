'use client'

import { useState } from 'react'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const GENERIC_ERROR = 'Não foi possível concluir. Tente de novo.'
const THROTTLED = 'Muitas tentativas. Tente de novo em alguns minutos.'

export function GuestButton({
  onEnter,
  variant = 'card',
}: {
  onEnter: () => Promise<{ throttled: true } | void>
  variant?: 'card' | 'plain'
}) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        variant === 'card' ? 'rounded-lg border border-border bg-card p-4' : 'items-start',
      )}
    >
      <Button
        type="button"
        variant={variant === 'card' ? 'secondary' : 'default'}
        size={variant === 'card' ? 'default' : 'lg'}
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setFailed(null)
          try {
            // In this Next version a redirect() inside the Server Action rejects
            // the awaited promise with a redirect error (the router navigates);
            // a plain resolve is also treated as success. Either way stay pending
            // because the page is navigating away. Only real failures show the error.
            const result = await onEnter()
            if (result?.throttled) {
              setFailed(THROTTLED)
              setPending(false)
            }
          } catch (error) {
            if (isRedirectError(error)) return
            // Never show server error text to users.
            setFailed(GENERIC_ERROR)
            setPending(false)
          }
        }}
      >
        Entrar como visitante
      </Button>
      {variant === 'card' && <p className="text-xs text-muted-foreground">Conta de demonstração com dados prontos</p>}
      {failed && <p role="alert" className="text-xs text-destructive">{failed}</p>}
    </div>
  )
}
