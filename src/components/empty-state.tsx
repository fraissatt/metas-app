import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * What a list or chart shows when it has nothing yet: what is missing, why,
 * and the next step. Dashed and quiet, so it never reads as an error.
 * `compact` is for inside a panel or beside a chart, where space is short.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  compact = false,
  className,
}: {
  icon: LucideIcon
  title: string
  /** One line on why it is empty or what happens next. */
  children?: ReactNode
  /** The next step: a link or a button. */
  action?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div
      data-empty-state=""
      className={cn(
        'flex rounded-lg border border-dashed border-border text-left',
        compact ? 'items-start gap-3 px-4 py-3' : 'flex-col items-start gap-3 px-5 py-6',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground',
          compact ? 'size-8' : 'size-10',
        )}
      >
        <Icon className={compact ? 'size-4' : 'size-5'} />
      </span>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {children && <p className="text-sm text-muted-foreground">{children}</p>}
        {action && <div className="mt-2 flex flex-wrap items-center gap-2">{action}</div>}
      </div>
    </div>
  )
}
