import { Children, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Related rows in one bordered panel, with a hairline between them. */
export function PanelList({ children, className }: { children: ReactNode; className?: string }) {
  if (Children.toArray(children).length === 0) return null

  return (
    <div className={cn('divide-y divide-border overflow-hidden rounded-lg border border-border bg-card', className)}>
      {children}
    </div>
  )
}
