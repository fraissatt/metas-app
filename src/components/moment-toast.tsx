'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import type { Moment } from '@/lib/moments'

const subscribeNever = () => () => {}

// Long enough to read two short lines without hurrying.
const VISIBLE_MS = 7000

/**
 * A quiet word when something was just achieved: a small card near the bottom
 * that reads itself to screen readers, leaves by itself and can be closed.
 * No glow, no confetti; under reduced motion it simply appears.
 *
 * `moment` identity is what matters: pass a new object to show it again.
 */
export function MomentToast({ moment, onDone }: { moment: Moment | null; onDone: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The portal needs the document, which the server render does not have.
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false)

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])
  const start = useCallback(() => {
    stop()
    timer.current = setTimeout(onDone, VISIBLE_MS)
  }, [onDone, stop])

  useEffect(() => {
    if (!moment) return
    start()
    return stop
  }, [moment, start, stop])

  if (!mounted) return null
  return createPortal(
    // The live region stays mounted and empty, so the message is announced when it arrives.
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem_+_env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6"
    >
      {moment && (
        <div
          data-moment=""
          onMouseEnter={stop}
          onMouseLeave={start}
          onFocus={stop}
          onBlur={start}
          className="moment-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-popover px-4 py-3 text-popover-foreground shadow-lg"
        >
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
          >
            <Check className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{moment.title}</p>
            <p className="text-sm text-muted-foreground">{moment.body}</p>
          </div>
          <button
            type="button"
            onClick={onDone}
            aria-label="Fechar aviso"
            className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}

/** State for one toast: `celebrate(moment)` shows it, the returned props feed `MomentToast`. */
export function useMoment() {
  const [moment, setMoment] = useState<Moment | null>(null)
  const onDone = useCallback(() => setMoment(null), [])
  return { moment, onDone, celebrate: setMoment }
}
