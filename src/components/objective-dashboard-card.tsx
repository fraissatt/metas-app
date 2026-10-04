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
        <span className="sr-only">{pluralWeeks(streak)} seguidas cumpridas</span>
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

function TimelineRow({ startDate, timeline }: { startDate: Date; timeline: Timeline }) {
  const start = formatDayMonth(startDate)
  if (timeline.kind === 'open') {
    return (
      <p className="text-xs text-muted-foreground">
        {`início ${start} · ativo há ${pluralWeeks(timeline.weeksActive)} · sem data-meta`}
      </p>
    )
  }
  const head = `início ${start} · ${timeline.elapsedPercent}% do prazo · `
  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-1.5 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-linear-to-r from-support to-primary"
          style={{ width: `${timeline.elapsedPercent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {timeline.overdue ? (
          <>
            {head}
            <span className="text-destructive">prazo encerrado</span>
          </>
        ) : (
          `${head}meta ${formatDayMonth(timeline.targetDate)}`
        )}
      </p>
    </div>
  )
}

export function ObjectiveDashboardCard({
  id,
  title,
  startDate,
  weeks,
  streak,
  timeline,
  onDelete,
}: {
  id: string
  title: string
  startDate: Date
  weeks: DashboardWeek[]
  streak: number
  timeline: Timeline
  onDelete: () => Promise<void>
}) {
  const rate = recentRate(weeks)
  const currentHasGoal = weeks.find((w) => w.current)?.hasGoal ?? false

  return (
    <div className="group/card rounded-lg border border-border bg-card p-4 flex flex-col gap-3 motion-safe:transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[0_0_16px_var(--glow)] focus-within:border-primary/40">
      <div className="flex items-start gap-2">
        <Link href={`/objectives/${id}`} className="min-w-0 flex-1 font-semibold line-clamp-2 break-words">
          {title}
        </Link>
        <Chip streak={streak} currentHasGoal={currentHasGoal} />
        <ObjectiveActionsMenu objectiveId={id} onDelete={onDelete} />
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-bold tabular-nums text-accent-foreground">{rate === null ? '—' : `${rate}%`}</p>
          <p className="text-xs text-muted-foreground">média das últimas 8 semanas</p>
        </div>
        <WeeklyBars weeks={weeks} className="w-[55%]" />
      </div>

      <TimelineRow startDate={startDate} timeline={timeline} />

      <div className="flex justify-end">
        <Link
          href={`/objectives/${id}?nova-meta=1#nova-meta`}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          + Meta da semana
        </Link>
      </div>
    </div>
  )
}
