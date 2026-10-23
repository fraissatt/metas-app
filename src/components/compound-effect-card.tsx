import { compoundFactor, formatFactor } from '@/lib/day-dots'
import { cn } from '@/lib/utils'

/** `flat`: inside a `PanelList`, which draws the frame. */
export function CompoundEffectCard({ daysDone, flat = false }: { daysDone: number; flat?: boolean }) {
  const worth = formatFactor(compoundFactor(daysDone))

  return (
    <section
      aria-label="Efeito composto"
      className={cn('px-4 py-3', !flat && 'rounded-lg border border-border bg-card')}
    >
      <h2 className="text-sm font-semibold text-primary">1% melhor a cada dia feito</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {daysDone === 0
          ? 'Cada dia feito soma 1%. Em um ano, isso vira 37×.'
          : daysDone === 1
            ? `Seu 1 dia feito já vale ${worth}`
            : `Seus ${daysDone} dias feitos já valem ${worth}`}
      </p>
      {/* Decorative: the curve only illustrates the sentence above. */}
      <svg viewBox="0 0 100 40" aria-hidden="true" className="mt-3 h-10 w-full overflow-visible">
        <path
          d="M2 38 C40 37 70 32 98 4"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </section>
  )
}
