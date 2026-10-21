'use client'

import { useRef, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Dot, DotLegend } from '@/components/dot'
import { appWeekdayIndex, formatMonthYear, parseDay } from '@/lib/dates'
import { monthFromDots, type DayDotsYear } from '@/lib/day-dots'

const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']
const ARROW = 'aria-disabled:pointer-events-none aria-disabled:opacity-40'

type Period = { year: number; month: number }

const monthIndex = ({ year, month }: Period) => year * 12 + (month - 1)
const fromIndex = (index: number): Period => ({ year: Math.floor(index / 12), month: (index % 12) + 1 })

export function MonthDotsDialog({
  initial,
  loadYear,
}: {
  initial: DayDotsYear
  loadYear: (year: number) => Promise<DayDotsYear>
}) {
  // `initial` is always the page's current-year data, so its current-day dot
  // says which month "now" is.
  const todayKey = initial.dots.find((dot) => dot.isCurrentDay)?.key
  const current: Period = { year: initial.year, month: todayKey ? Number(todayKey.slice(5, 7)) : 1 }
  const first: Period = { year: initial.firstYear, month: 1 }

  const [shown, setShown] = useState<{ period: Period; data: DayDotsYear }>({ period: current, data: initial })
  // Clicks move the target at once; only the newest request is allowed to
  // land, so two quick clicks while a year loads never skip or repeat a month.
  const target = useRef<Period>(current)
  const request = useRef(0)

  function reset() {
    request.current += 1
    target.current = current
    setShown({ period: current, data: initial })
  }

  async function move(delta: number) {
    const next = fromIndex(monthIndex(target.current) + delta)
    if (monthIndex(next) < monthIndex(first) || monthIndex(next) > monthIndex(current)) return
    const before = target.current
    target.current = next
    const id = ++request.current

    try {
      const data = next.year === initial.year ? initial : await loadYear(next.year)
      if (id === request.current) setShown({ period: next, data })
    } catch {
      // The year did not load: stay on the month on screen, so the next click
      // retries it instead of skipping ahead.
      if (id === request.current) target.current = before
    }
  }

  const { period, data } = shown
  const dots = monthFromDots(data.dots, period.year, period.month)
  const firstDay = parseDay(`${period.year}-${String(period.month).padStart(2, '0')}-01`)
  const title = formatMonthYear(firstDay)
  const isCurrentMonth = monthIndex(period) === monthIndex(current)
  const elapsed = dots.findIndex((dot) => dot.isCurrentDay) + 1
  const done = dots.filter((dot) => dot.tone === 'done').length
  const summary = `${done} de ${isCurrentMonth ? elapsed : dots.length} dias feitos`
  const atStart = monthIndex(period) <= monthIndex(first)
  const atEnd = isCurrentMonth

  return (
    <Dialog onOpenChange={reset}>
      <DialogTrigger render={<Button type="button" variant="outline" size="xs" />}>Ver o mês</DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        {/* pr-8 keeps the next arrow clear of the dialog's own close button */}
        <DialogHeader className="flex-row items-center justify-between gap-2 pr-10">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Mês anterior"
            aria-disabled={atStart}
            className={ARROW}
            onClick={() => move(-1)}
          >
            <ChevronLeftIcon />
          </Button>
          <DialogTitle aria-live="polite" className="first-letter:uppercase">
            {title}
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Próximo mês"
            aria-disabled={atEnd}
            className={ARROW}
            onClick={() => move(1)}
          >
            <ChevronRightIcon />
          </Button>
        </DialogHeader>

        <div aria-hidden="true" className="grid grid-cols-7 justify-items-center gap-1.5 text-[10px] text-muted-foreground">
          {WEEKDAYS.map((weekday, i) => (
            <span key={i}>{weekday}</span>
          ))}
        </div>
        <div role="img" aria-label={`${title}: ${summary}`} className="grid grid-cols-7 justify-items-center gap-1.5">
          {Array.from({ length: appWeekdayIndex(firstDay) }, (_, i) => (
            <Dot key={`blank-${i}`} dot={null} size="md" />
          ))}
          {dots.map((dot) => (
            <Dot key={dot.key} dot={dot} size="md" />
          ))}
        </div>

        <p className="text-xs text-muted-foreground tabular-nums">{summary}</p>
        {initial.daysDone === 0 && (
          <p className="text-xs text-muted-foreground">
            Seu primeiro ponto acende quando você concluir 60% das tarefas de um dia.
          </p>
        )}
        <DotLegend />
      </DialogContent>
    </Dialog>
  )
}
