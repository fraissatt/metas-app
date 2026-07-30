'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

// General safety net for any Server Action failure across the Objectives /
// WeeklyGoals / DailyTasks CRUD surfaces — e.g. a stale card on `/` or
// `/week` surviving a cascade delete elsewhere, whose toggle/edit/delete
// action then throws because the underlying row is already gone.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Algo deu errado</h1>
      <p className="text-muted-foreground">
        Ocorreu um erro inesperado. Isso pode acontecer se o item que você tentou alterar já foi
        excluído em outro lugar.
      </p>
      <Button onClick={() => reset()}>Tentar novamente</Button>
    </main>
  )
}
