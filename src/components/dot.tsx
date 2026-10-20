import { formatDate, parseDay } from '@/lib/dates'
import type { DayDot, DayTone } from '@/lib/day-dots'
import { cn } from '@/lib/utils'

export const TONE_LABEL: Record<DayTone, string> = {
  empty: 'Nada feito',
  partial: 'Parte feita',
  done: 'Dia feito',
}

const TONE_CLASS: Record<DayTone, string> = {
  empty: 'bg-muted',
  partial: 'bg-primary/35',
  done: 'bg-primary',
}

const SIZE_CLASS = { sm: 'size-2.5 rounded-[3px]', md: 'size-[18px] rounded-full' }

/** One day. Decorative for screen readers: each grid carries its own label. */
export function Dot({ dot, size }: { dot: DayDot | null; size: 'sm' | 'md' }) {
  if (!dot) return <span aria-hidden="true" className={cn(SIZE_CLASS[size], 'invisible')} />
  return (
    <span
      aria-hidden="true"
      data-tone={dot.tone}
      data-current-day={dot.isCurrentDay || undefined}
      title={`${formatDate(parseDay(dot.key))} · ${TONE_LABEL[dot.tone]}`}
      className={cn(
        SIZE_CLASS[size],
        TONE_CLASS[dot.tone],
        dot.isCurrentDay && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
      )}
    />
  )
}

export function DotLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {(Object.keys(TONE_LABEL) as DayTone[]).map((tone) => (
        <li key={tone} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('size-2.5 rounded-full', TONE_CLASS[tone])} />
          {TONE_LABEL[tone]}
        </li>
      ))}
    </ul>
  )
}

export function daysDoneLabel(count: number): string {
  return count === 1 ? '1 dia feito' : `${count} dias feitos`
}
