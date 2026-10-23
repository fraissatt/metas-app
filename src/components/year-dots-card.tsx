'use client'

import { useRef, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dot, DotLegend, daysDoneLabel } from '@/components/dot'
import { MonthDotsDialog } from '@/components/month-dots-dialog'
import { formatMonthShort, parseDay } from '@/lib/dates'
import { layoutYearWeeks, type DayDotsYear } from '@/lib/day-dots'
import { cn } from '@/lib/utils'

const ARROW = 'aria-disabled:pointer-events-none aria-disabled:opacity-40'
// A week column never gets narrower than a dot plus its gap; below that the
// grid scrolls inside the card instead of widening the page.
const COLUMN_REM = 0.875

export function YearDotsCard({
  initial,
  loadYear,
  flat = false,
}: {
  initial: DayDotsYear
  loadYear: (year: number) => Promise<DayDotsYear>
  /** Inside a `PanelList`, which draws the frame. */
  flat?: boolean
}) {
  const [data, setData] = useState(initial)
  // Toggling a task re-renders the page with a new `initial`; state alone
  // would keep showing the first render, so follow the page when it changes.
  const [seen, setSeen] = useState(initial)
  if (seen !== initial) {
    setSeen(initial)
    setData(initial)
  }
  const request = useRef(0)

  const weeks = layoutYearWeeks(data.dots)
  const done = daysDoneLabel(data.dots.filter((dot) => dot.tone === 'done').length)
  const browsable = data.firstYear < data.currentYear
  const atStart = data.year <= data.firstYear
  const atEnd = data.year >= data.currentYear

  async function go(year: number) {
    const id = ++request.current
    const next = year === initial.year ? initial : await loadYear(year)
    if (id === request.current) setData(next)
  }

  return (
    <section
      aria-label="Calendário do ano"
      className={cn('px-4 py-3', !flat && 'rounded-lg border border-border bg-card')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {browsable && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Ano anterior"
              aria-disabled={atStart}
              className={ARROW}
              onClick={() => !atStart && go(data.year - 1)}
            >
              <ChevronLeftIcon />
            </Button>
          )}
          <h3 aria-live="polite" className="text-sm font-semibold tabular-nums">
            {data.year}
          </h3>
          {browsable && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Próximo ano"
              aria-disabled={atEnd}
              className={ARROW}
              onClick={() => !atEnd && go(data.year + 1)}
            >
              <ChevronRightIcon />
            </Button>
          )}
        </div>
        <MonthDotsDialog initial={initial} loadYear={loadYear} />
      </div>

      <div className="mt-3 overflow-x-auto pb-1">
        <div style={{ minWidth: `${weeks.length * COLUMN_REM}rem` }}>
          <div
            aria-hidden="true"
            className="grid gap-1 text-[10px] text-muted-foreground"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
          >
            {/* Month labels sit over the column that holds each month's first day. */}
            {weeks.map((week, i) => {
              const first = week.find((dot) => dot?.key.endsWith('-01'))
              return (
                <span key={i} className="h-4 justify-self-start whitespace-nowrap">
                  {first ? formatMonthShort(parseDay(first.key)) : ''}
                </span>
              )
            })}
          </div>
          <div
            role="img"
            aria-label={`${data.year}: ${done}`}
            className="grid grid-flow-col grid-rows-7 justify-items-center gap-1"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
          >
            {weeks.flat().map((dot, i) => (
              <Dot key={dot?.key ?? `blank-${i}`} dot={dot} size="sm" />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <DotLegend />
        <p className="text-xs text-muted-foreground tabular-nums">{`${done} em ${data.year}`}</p>
      </div>
      {initial.daysDone === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Seu primeiro ponto acende quando você concluir 60% das tarefas de um dia.
        </p>
      )}
    </section>
  )
}
