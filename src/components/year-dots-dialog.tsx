'use client'

import { useState, useTransition } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Dot, DotLegend, daysDoneLabel } from '@/components/dot'
import { formatMonthShort, parseDay } from '@/lib/dates'
import { layoutYearWeeks, type DayDotsYear } from '@/lib/day-dots'

export function YearDotsDialog({
  initial,
  loadYear,
}: {
  initial: DayDotsYear
  loadYear: (year: number) => Promise<DayDotsYear>
}) {
  const [data, setData] = useState(initial)
  const [isPending, startTransition] = useTransition()

  const weeks = layoutYearWeeks(data.dots)
  const done = daysDoneLabel(data.dots.filter((dot) => dot.tone === 'done').length)
  const browsable = data.firstYear < data.currentYear

  function go(year: number) {
    startTransition(async () => {
      const next = await loadYear(year)
      // State set after an await needs its own transition (React 19).
      startTransition(() => setData(next))
    })
  }

  return (
    // Start from the page's latest data on every open: toggling a task
    // revalidates the page and sends a new `initial`, which state would ignore.
    <Dialog onOpenChange={() => setData(initial)}>
      <DialogTrigger render={<Button type="button" variant="link" className="h-auto p-0 text-xs" />}>
        Ver o ano
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader className="flex-row items-center gap-2">
          {browsable && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Ano anterior"
              disabled={isPending || data.year <= data.firstYear}
              onClick={() => go(data.year - 1)}
            >
              <ChevronLeftIcon />
            </Button>
          )}
          <DialogTitle className="tabular-nums">{data.year}</DialogTitle>
          {browsable && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Próximo ano"
              disabled={isPending || data.year >= data.currentYear}
              onClick={() => go(data.year + 1)}
            >
              <ChevronRightIcon />
            </Button>
          )}
        </DialogHeader>

        <div className="overflow-x-auto pb-1" aria-busy={isPending}>
          <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${weeks.length}, 0.625rem)` }}>
            {/* Month labels sit over the column holding each month's first day. */}
            {weeks.map((week, i) => {
              const first = week.find((dot) => dot?.key.endsWith('-01'))
              return (
                <span key={i} aria-hidden="true" className="h-4 overflow-visible text-[10px] whitespace-nowrap text-muted-foreground">
                  {first ? formatMonthShort(parseDay(first.key)) : ''}
                </span>
              )
            })}
          </div>
          <div
            role="img"
            aria-label={`${data.year}: ${done}`}
            className="grid grid-flow-col grid-rows-7 gap-1"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, 0.625rem)` }}
          >
            {weeks.flat().map((dot, i) => (
              <Dot key={dot?.key ?? `blank-${i}`} dot={dot} size="sm" />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <DotLegend />
          <p className="text-xs text-muted-foreground">{`${done} em ${data.year}`}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
