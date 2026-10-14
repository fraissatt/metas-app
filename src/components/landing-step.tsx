import type { CSSProperties, ReactNode, Ref } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { LandingColor } from '@/components/landing-card'
import { cn } from '@/lib/utils'

export function LandingStep({
  index,
  icon: Icon,
  title,
  text,
  screen,
  points,
  practice,
  color,
  last = false,
  active = false,
  className,
  ref,
  children,
}: {
  /** Zero-based position among the steps. */
  index: number
  icon: LucideIcon
  title: string
  text: string
  screen: string
  points: readonly string[]
  /** An example taken from the demo's own data. */
  practice: string
  color: LandingColor
  last?: boolean
  active?: boolean
  className?: string
  ref?: Ref<HTMLLIElement>
  /** The step's demo card: under the text on phones, beside it from lg up. */
  children?: ReactNode
}) {
  return (
    <li
      ref={ref}
      data-step={index}
      aria-current={active ? 'step' : undefined}
      className={cn('flex gap-4', className)}
      // --vN (set by the parent from the scroll) fades the step in as the demo reaches its view.
      style={
        {
          '--card-color': `var(--lp-${color})`,
          opacity: `calc(0.4 + 0.6 * var(--v${index}, ${active ? 1 : 0}))`,
        } as CSSProperties
      }
    >
      <div className="flex flex-col items-center" aria-hidden="true">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-base font-semibold"
          style={{ color: 'var(--card-color)', background: 'color-mix(in oklab, var(--card-color) 16%, transparent)' }}
        >
          {index + 1}
        </span>
        {/* The rail between two steps fills as the scroll (--p) moves from one to the next. */}
        {!last && (
          <span className="mt-1 w-px flex-1 bg-border">
            <span
              className="block w-px bg-[var(--card-color)]"
              style={{ height: `calc(clamp(0, var(--p, 0) - ${index}, 1) * 100%)` }}
            />
          </span>
        )}
      </div>
      <div
        className={cn(
          'grid min-w-0 flex-1 gap-5 lg:grid-cols-2 lg:items-center lg:gap-12',
          last ? 'pb-0' : 'pb-12 lg:pb-24',
        )}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex items-center gap-2 text-xl font-semibold">
              <Icon className="size-5" style={{ color: 'var(--card-color)' }} aria-hidden="true" />
              {title}
            </h3>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ color: 'var(--card-color)', background: 'color-mix(in oklab, var(--card-color) 14%, transparent)' }}
            >
              {screen}
            </span>
          </div>
          <p className="max-w-md text-base text-muted-foreground">{text}</p>
          <div className="max-w-md rounded-lg border border-border bg-card/60 p-3">
            <p className="text-xs font-medium text-muted-foreground">Na prática</p>
            <p className="mt-0.5 text-sm font-medium">{practice}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {points.map((point) => (
              <p key={point} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: 'var(--card-color)' }} aria-hidden="true" />
                {point}
              </p>
            ))}
          </div>
        </div>
        {children}
      </div>
    </li>
  )
}
