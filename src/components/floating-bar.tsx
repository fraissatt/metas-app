'use client'

import { useRef, type ComponentProps } from 'react'
import { useScrollHide } from '@/components/use-scroll-hide'
import { cn } from '@/lib/utils'

type Edge = 'top' | 'bottom'

const OUT: Record<Edge, string> = { top: '-translate-y-[130%]', bottom: 'translate-y-[130%]' }

/**
 * A bar that floats at the top or the bottom and slides out while the page scrolls down.
 * Hidden means inert (Tab skips it), invisible and translated away; the transition only
 * runs when motion is allowed.
 */
export function FloatingBar({
  edge,
  when,
  className,
  children,
  ...props
}: { edge: Edge; when?: string } & ComponentProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null)
  const hidden = useScrollHide(ref, when)

  return (
    <div
      ref={ref}
      data-edge={edge}
      data-hidden={hidden}
      inert={hidden}
      className={cn(
        // Slow, soft slide out (it fades along the way) and a slightly quicker return.
        'motion-safe:transition-[transform,opacity] motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]',
        hidden ? 'motion-safe:duration-700' : 'motion-safe:duration-500',
        hidden && cn(OUT[edge], 'pointer-events-none opacity-0'),
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
