import Link from 'next/link'
import { formatDayMonth } from '@/lib/dates'
import { cn } from '@/lib/utils'

const R = 8
const C = 2 * Math.PI * R

export function DaySummary({ completed, total, weekStart }: { completed: number; total: number; weekStart: Date }) {
  const week = `semana de ${formatDayMonth(weekStart)}`
  const empty = total === 0
  const done = !empty && completed >= total
  const ratio = Math.min(1, Math.max(0, completed / total))
  const label = empty ? `Nenhuma tarefa hoje, ${week}` : `${completed} de ${total} hoje, ${week}`

  return (
    <Link
      href="/"
      aria-label={label}
      className="flex items-center gap-2 rounded-md px-2 py-1 text-sm tabular-nums text-muted-foreground transition-colors hover:text-foreground"
    >
      {!empty && (
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          aria-hidden="true"
          data-testid="summary-ring"
          data-complete={done}
          className={cn('-rotate-90 overflow-visible', done && 'drop-shadow-[0_0_4px_var(--primary)]')}
        >
          <circle cx="10" cy="10" r={R} fill="none" stroke="var(--muted)" strokeWidth="3" />
          <circle
            cx="10"
            cy="10"
            r={R}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C - ratio * C}
          />
        </svg>
      )}
      <span aria-hidden="true" className="md:hidden">
        {empty ? '0' : `${completed}/${total}`}
      </span>
      <span aria-hidden="true" className="hidden md:inline">
        <span className="text-foreground">{empty ? 'Nenhuma tarefa hoje' : `${completed} de ${total} hoje`}</span>
        <span className="hidden lg:inline">{` · ${week}`}</span>
      </span>
    </Link>
  )
}
