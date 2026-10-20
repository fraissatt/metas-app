import { Dot } from '@/components/dot'
import { YearDotsDialog } from '@/components/year-dots-dialog'
import { getDayDots } from '@/lib/actions/stats'
import { appWeekdayIndex, formatDayKey, formatMonthYear, getMonthDays } from '@/lib/dates'
import type { DayDotsYear } from '@/lib/day-dots'

const WEEKDAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

export function MonthDots({ data, now }: { data: DayDotsYear; now: Date }) {
  const days = getMonthDays(now)
  const byKey = new Map(data.dots.map((dot) => [dot.key, dot]))
  const dots = days.map((day) => byKey.get(formatDayKey(day)) ?? null)
  const elapsed = dots.findIndex((dot) => dot?.isCurrentDay) + 1
  const done = dots.filter((dot) => dot?.tone === 'done').length
  const month = formatMonthYear(now)
  const summary = `${done} de ${elapsed} dias feitos`
  const blanks = appWeekdayIndex(days[0])

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-3">
      <h2 className="text-sm font-semibold first-letter:uppercase">{month}</h2>
      <div aria-hidden="true" className="mt-2 grid grid-cols-7 gap-1.5 text-center text-[10px] text-muted-foreground">
        {WEEKDAYS.map((weekday, i) => (
          <span key={i}>{weekday}</span>
        ))}
      </div>
      <div role="img" aria-label={`${month}: ${summary}`} className="mt-1 grid grid-cols-7 justify-items-center gap-1.5">
        {Array.from({ length: blanks }, (_, i) => (
          <Dot key={`blank-${i}`} dot={null} size="md" />
        ))}
        {dots.map((dot, i) => (
          <Dot key={dot?.key ?? `missing-${i}`} dot={dot} size="md" />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground tabular-nums">{summary}</p>
      {data.daysDone === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Seu primeiro ponto acende quando você concluir 60% das tarefas de um dia.
        </p>
      )}
      <div className="mt-2">
        <YearDotsDialog initial={data} loadYear={getDayDots} />
      </div>
    </section>
  )
}
