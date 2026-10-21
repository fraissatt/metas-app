import { CompoundEffectCard } from '@/components/compound-effect-card'
import { YearDotsCard } from '@/components/year-dots-card'
import { getDayDots } from '@/lib/actions/stats'
import type { DayDotsYear } from '@/lib/day-dots'

/** What the days done add up to, under the Today content, in the same column. */
export function SmallStepsSection({ data }: { data: DayDotsYear }) {
  return (
    <section aria-labelledby="pequenos-passos" className="mt-10 flex flex-col gap-4">
      <h2 id="pequenos-passos" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Seus pequenos passos
      </h2>
      <CompoundEffectCard daysDone={data.daysDone} />
      <YearDotsCard initial={data} loadYear={getDayDots} />
    </section>
  )
}
