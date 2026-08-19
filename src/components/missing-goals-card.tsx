'use client'

import { useTransition } from 'react'
import { format } from 'date-fns'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MissingGoalsPreview } from '@/lib/actions/weeklyGoals'

export function MissingGoalsCard({
  preview,
  onRepeat,
}: {
  preview: MissingGoalsPreview
  onRepeat: () => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()

  return (
    // Listed before the click rather than behind a confirmation step: it tells
    // the user what the button will do and, just as importantly, reminds them
    // what they had committed to.
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Ficou para trás · semana de {format(preview.sourceWeekStart, 'dd/MM')}
      </span>

      <div className="flex flex-col gap-1">
        {preview.goals.map((goal) => (
          <div key={goal.id} className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 break-words">{goal.title}</span>
            <span className="shrink-0 text-muted-foreground">
              {goal.taskCount} {goal.taskCount === 1 ? 'tarefa' : 'tarefas'}
            </span>
          </div>
        ))}
      </div>

      <Button type="button" disabled={isPending} onClick={() => startTransition(() => onRepeat())}>
        <RotateCcw className="size-4" />
        {isPending ? 'Trazendo…' : 'Trazer para esta semana'}
      </Button>
    </div>
  )
}
