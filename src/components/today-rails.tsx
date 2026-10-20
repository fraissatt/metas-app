import type { ReactNode } from 'react'
import { CompoundEffectCard } from '@/components/compound-effect-card'
import { MonthDots } from '@/components/month-dots'
import type { DayDotsYear } from '@/lib/day-dots'
import { cn } from '@/lib/utils'

// The rails only exist from 2xl, where the margins beside the Today content
// are wide enough; below that the page renders exactly as before.
const RAIL = 'hidden 2xl:block sticky top-24 self-start pt-8'

export function TodayRails({
  data,
  width,
  children,
}: {
  data: DayDotsYear
  /** Width of the content column, matching the `<main>` it wraps. */
  width: 'wide' | 'narrow'
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        // Auto margins shrink a grid item to its content, so the main is told to
        // fill its column (it already does in normal block flow).
        '2xl:grid 2xl:justify-center 2xl:gap-6 [&>main]:w-full',
        width === 'wide'
          ? '2xl:grid-cols-[170px_minmax(0,72rem)_170px]'
          : '2xl:grid-cols-[170px_minmax(0,42rem)_170px]',
      )}
    >
      <aside aria-label="Efeito composto" className={RAIL}>
        <CompoundEffectCard daysDone={data.daysDone} />
      </aside>
      {children}
      <aside aria-label="Calendário" className={RAIL}>
        <MonthDots data={data} now={new Date()} />
      </aside>
    </div>
  )
}
