'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { formatDayMonth } from '@/lib/dates'
import type { DashboardWeek } from '@/lib/objective-dashboard'

export function barLabel(week: DashboardWeek): string {
  const day = formatDayMonth(week.weekStart)
  if (!week.hasGoal) return `${day} · sem meta`
  const progress = `${week.completed}/${week.total}${week.fulfilled ? ' ✓' : ''}`
  return `${day} · ${progress}${week.current ? ' (em andamento)' : ''}`
}

export function WeeklyBars({ weeks, className }: { weeks: DashboardWeek[]; className?: string }) {
  const [active, setActive] = useState<number | null>(null)

  return (
    <div role="group" aria-label="Últimas 8 semanas" className={cn('relative flex h-10 items-end gap-1', className)}>
      {weeks.map((week, index) => (
        <span
          key={week.weekStart.getTime()}
          role="img"
          aria-label={barLabel(week)}
          tabIndex={0}
          onMouseEnter={() => setActive(index)}
          onFocus={() => setActive(index)}
          onMouseLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          style={{ height: week.hasGoal ? `${Math.max(week.percent, 4)}%` : '2px' }}
          className={cn(
            'relative flex-1 rounded-t-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            week.fulfilled ? 'bg-linear-to-t from-chart-4 to-primary' : 'bg-chart-1',
            week.current && 'outline-1 outline-dashed outline-muted-foreground/60',
          )}
        />
      ))}
      {active !== null && (
        <span
          role="tooltip"
          style={{ left: `${((active + 0.5) / weeks.length) * 100}%` }}
          className="pointer-events-none absolute bottom-full mb-1 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-popover px-1.5 py-0.5 text-[11px] text-popover-foreground shadow"
        >
          {barLabel(weeks[active])}
        </span>
      )}
    </div>
  )
}
