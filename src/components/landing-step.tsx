import type { CSSProperties, Ref } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { LandingColor } from '@/components/landing-card'
import { cn } from '@/lib/utils'

export function LandingStep({
  number,
  icon: Icon,
  title,
  text,
  color,
  last = false,
  active = false,
  className,
  ref,
}: {
  number: number
  icon: LucideIcon
  title: string
  text: string
  color: LandingColor
  last?: boolean
  active?: boolean
  className?: string
  ref?: Ref<HTMLLIElement>
}) {
  return (
    <li
      ref={ref}
      aria-current={active ? 'step' : undefined}
      className={cn(
        'flex gap-4 transition-opacity motion-reduce:transition-none',
        active ? 'opacity-100' : 'opacity-50',
        className,
      )}
      style={{ '--card-color': `var(--lp-${color})` } as CSSProperties}
    >
      <div className="flex flex-col items-center" aria-hidden="true">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
          style={{ color: 'var(--card-color)', background: 'color-mix(in oklab, var(--card-color) 16%, transparent)' }}
        >
          {number}
        </span>
        {!last && <span className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className={last ? 'pb-0' : 'pb-8'}>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Icon className="size-4" style={{ color: 'var(--card-color)' }} aria-hidden="true" />
          {title}
        </h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{text}</p>
      </div>
    </li>
  )
}
