import { format } from 'date-fns'
import type { LifetimeStats } from '@/lib/stats'
import { cn } from '@/lib/utils'

export function LifetimeProgressBanner({ totalCompleted, firstCompletedAt, weekWindow }: LifetimeStats) {
  const activeWeeks = weekWindow.filter((week) => week.active).length
  const isFirstWeek =
    weekWindow.length === 1 && firstCompletedAt !== null && firstCompletedAt >= weekWindow[0].weekStart

  return (
    <section
      aria-label="Progresso acumulado"
      className="mb-6 flex flex-col gap-3 rounded-lg border border-primary bg-accent px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-primary">{totalCompleted}</span>
        <span className="text-sm text-muted-foreground">
          {totalCompleted === 1 ? 'tarefa concluída' : 'tarefas concluídas'}
          {firstCompletedAt ? ` desde ${format(firstCompletedAt, 'dd/MM/yyyy')}` : ''}
        </span>
      </p>

      {weekWindow.length > 0 && (
        <div className="flex items-center gap-2">
          {/* The dots are decorative: the sibling label carries the same
              information as text, so screen readers get it once, not twice. */}
          <div className="flex gap-1" aria-hidden="true">
            {weekWindow.map((week) => (
              <span
                key={week.weekStart.toISOString()}
                data-testid="week-dot"
                data-active={week.active}
                title={`Semana de ${format(week.weekStart, 'dd/MM')}`}
                className={cn('size-2 rounded-full', week.active ? 'bg-primary' : 'bg-muted')}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {isFirstWeek
              ? 'Sua primeira semana'
              : weekWindow.length === 1
                ? '1 semana ativa'
                : `${activeWeeks} das últimas ${weekWindow.length} semanas`}
          </span>
        </div>
      )}
    </section>
  )
}
