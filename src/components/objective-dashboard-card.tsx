import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { ObjectiveActionsMenu } from '@/components/objective-actions-menu'
import { WeeklyBars } from '@/components/weekly-bars'
import { formatDayMonth } from '@/lib/dates'
import { recentRate, type DashboardWeek, type Timeline } from '@/lib/objective-dashboard'

function pluralWeeks(n: number): string {
  return `${n} ${n === 1 ? 'semana' : 'semanas'}`
}

function Chip({ streak, currentHasGoal }: { streak: number; currentHasGoal: boolean }) {
  if (streak > 0) {
    return (
      <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
        <span aria-hidden="true">🔥 {pluralWeeks(streak)}</span>
        <span className="sr-only">
          {streak === 1 ? '1 semana seguida cumprida' : `${streak} semanas seguidas cumpridas`}
        </span>
      </span>
    )
  }
  if (!currentHasGoal) {
    return (
      <span className="shrink-0 rounded-full bg-support-muted px-2 py-0.5 text-xs font-medium text-support-foreground">
        sem meta nesta semana
      </span>
    )
  }
  return null
}

/** The deadline as one line of text: the list stays quiet, the detail lives on the objective's page. */
function TimelineText({ timeline }: { timeline: Timeline }) {
  if (timeline.kind === 'open') {
    return <>{`ativo há ${pluralWeeks(timeline.weeksActive)} · sem data-meta`}</>
  }
  if (timeline.overdue) return <span className="text-destructive">prazo encerrado</span>
  return <>{`${timeline.elapsedPercent}% do prazo · meta ${formatDayMonth(timeline.targetDate)}`}</>
}

/**
 * One objective as a row. It draws no frame of its own: the page puts the rows
 * in a `PanelList`, which supplies the border and the hairlines between them.
 */
export function ObjectiveDashboardCard({
  id,
  title,
  weeks,
  streak,
  timeline,
  onDelete,
}: {
  id: string
  title: string
  weeks: DashboardWeek[]
  streak: number
  timeline: Timeline
  onDelete: () => Promise<void>
}) {
  const rate = recentRate(weeks)
  const currentHasGoal = weeks.find((w) => w.current)?.hasGoal ?? false

  return (
    <div className="card-roomy flex flex-col gap-3 p-4">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1">
          <Link href={`/objectives/${id}`} className="block font-semibold line-clamp-2 break-words">
            {title}
          </Link>
        </h3>
        <Chip streak={streak} currentHasGoal={currentHasGoal} />
        <ObjectiveActionsMenu objectiveId={id} title={title} onDelete={onDelete} />
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-2xl font-bold tabular-nums text-accent-foreground">{rate === null ? '—' : `${rate}%`}</p>
          <p className="text-xs text-muted-foreground">8 sem.</p>
        </div>
        <WeeklyBars weeks={weeks} className="w-1/2" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="text-xs text-muted-foreground">
          <TimelineText timeline={timeline} />
        </p>
        <Link
          href={`/objectives/${id}?nova-meta=1#nova-meta`}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          + Meta
        </Link>
      </div>
    </div>
  )
}
