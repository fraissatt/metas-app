import type { ObjectiveStats } from '@/lib/objectives'
import { cn } from '@/lib/utils'
import { formatDayMonth } from '@/lib/dates'

export function ObjectiveStatsPanel({
  stats,
  compact = false,
  completed = false,
}: {
  stats: ObjectiveStats
  compact?: boolean
  completed?: boolean
}) {
  const { weeksFulfilled, tasksCompleted, weeksSinceStart, recentWeeks } = stats

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm tabular-nums">
        <span className="font-semibold text-primary">
          {weeksFulfilled} {weeksFulfilled === 1 ? 'semana cumprida' : 'semanas cumpridas'}
        </span>
        <span className="text-muted-foreground">
          {' · '}
          {tasksCompleted} {tasksCompleted === 1 ? 'tarefa' : 'tarefas'}
          {' · '}
          {completed ? 'durou' : 'ativo há'} {weeksSinceStart}{' '}
          {weeksSinceStart === 1 ? 'semana' : 'semanas'}
        </span>
      </p>

      {!compact && recentWeeks.length > 0 && (
        <div className="flex h-3 gap-0.5" aria-hidden="true">
          {recentWeeks.map((week) => (
            <span
              key={week.weekStart.toISOString()}
              data-testid="week-segment"
              data-fulfilled={week.fulfilled}
              title={`Semana de ${formatDayMonth(week.weekStart)}: ${week.completed}/${week.total}`}
              className={cn('flex-1 rounded-sm', week.fulfilled ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
