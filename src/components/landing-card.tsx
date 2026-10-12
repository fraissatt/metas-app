import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'

export type LandingColor = 'green' | 'blue' | 'amber' | 'violet' | 'pink' | 'cyan'

export function LandingCard({
  icon: Icon,
  title,
  text,
  color,
  index,
}: {
  icon: LucideIcon
  title: string
  text: string
  color: LandingColor
  index: number
}) {
  return (
    <li
      className="landing-card rounded-xl border border-border bg-card p-4"
      style={{ '--card-color': `var(--lp-${color})`, '--i': index } as CSSProperties}
    >
      <span
        className="landing-card-icon mb-3 flex size-9 items-center justify-center rounded-lg"
        style={{ color: 'var(--card-color)', background: 'color-mix(in oklab, var(--card-color) 16%, transparent)' }}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </li>
  )
}
