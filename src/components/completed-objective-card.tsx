import Link from 'next/link'
import { ObjectiveActionsMenu } from '@/components/objective-actions-menu'
import { formatDate } from '@/lib/dates'
import { describeSchedule } from '@/lib/objectives'

export function CompletedObjectiveCard({
  id,
  title,
  completedAt,
  targetDate,
  weeksFulfilled,
  tasksCompleted,
  onDelete,
}: {
  id: string
  title: string
  completedAt: Date | null
  targetDate: Date | null
  weeksFulfilled: number
  tasksCompleted: number
  onDelete: () => Promise<void>
}) {
  const schedule = completedAt ? describeSchedule(completedAt, targetDate) : null
  const completedText = completedAt
    ? `✓ Concluído em ${formatDate(completedAt)}${schedule ? ` · ${schedule}` : ''}`
    : '✓ Concluído'
  const weeksText = weeksFulfilled === 1 ? 'semana cumprida' : 'semanas cumpridas'
  const tasksText = tasksCompleted === 1 ? 'tarefa' : 'tarefas'

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1">
          <Link href={`/objectives/${id}`} className="block font-semibold line-clamp-2 break-words">
            {title}
          </Link>
        </h3>
        <ObjectiveActionsMenu objectiveId={id} title={title} onDelete={onDelete} />
      </div>
      <p className="text-sm font-medium text-accent-foreground">
        {completedText}
      </p>
      <p className="text-sm text-muted-foreground">
        {`${weeksFulfilled} ${weeksText} · ${tasksCompleted} ${tasksText}`}
      </p>
    </div>
  )
}
