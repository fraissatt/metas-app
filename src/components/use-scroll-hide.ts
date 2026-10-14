'use client'

import { useEffect, useState, type RefObject } from 'react'
import { nextScrollState, type ScrollState } from '@/lib/scroll-hide'

// "In use": focus inside the bar, one of its menus open, or any dialog open (search).
function isPinned(element: HTMLElement | null): boolean {
  if (!element) return false
  return (
    element.contains(document.activeElement) ||
    element.querySelector('[aria-expanded="true"]') !== null ||
    document.querySelector('[role="dialog"]') !== null
  )
}

/**
 * Whether the bar should be hidden for the current scroll. `when` is a media query:
 * outside it the bar is never hidden (it is the plain bar of another screen size).
 */
export function useScrollHide(ref: RefObject<HTMLElement | null>, when?: string): boolean {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let state: ScrollState = { hidden: false, lastY: window.scrollY }
    let frame = 0
    let scheduled = false

    const applies = () => !when || (typeof matchMedia === 'function' && matchMedia(when).matches)

    function update() {
      scheduled = false
      state = applies()
        ? nextScrollState(state, window.scrollY, isPinned(ref.current))
        : { hidden: false, lastY: window.scrollY }
      setHidden((current) => (current === state.hidden ? current : state.hidden))
    }

    const schedule = () => {
      if (scheduled) return
      scheduled = true
      frame = requestAnimationFrame(update)
    }

    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (scheduled) cancelAnimationFrame(frame)
    }
  }, [ref, when])

  return hidden
}
