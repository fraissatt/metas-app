'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { isNavigationClick } from '@/lib/navigation-click'

type Phase = 'idle' | 'loading' | 'done'

// If a click never turns into a new page (an error, a link to the same
// place the guard missed), the bar must not hang there forever.
const GIVE_UP_MS = 15_000
// How long the bar takes to fill and fade once the new page is in.
const FINISH_MS = 400

function Bar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const location = `${pathname}?${searchParams.toString()}`
  const [phase, setPhase] = useState<Phase>('idle')
  const [seen, setSeen] = useState(location)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The page changed: finish the bar (if one is running).
  if (seen !== location) {
    setSeen(location)
    if (phase === 'loading') setPhase('done')
  }

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!isNavigationClick(event, window.location)) return
      setPhase('loading')
    }
    // Capture: Next's <Link> cancels the click's default before it bubbles.
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  useEffect(() => {
    if (phase === 'idle') return
    timer.current = setTimeout(() => setPhase('idle'), phase === 'done' ? FINISH_MS : GIVE_UP_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [phase])

  if (phase === 'idle') return null
  return (
    <div aria-hidden="true" data-phase={phase} className="nav-progress">
      <div className="nav-progress-bar" />
    </div>
  )
}

/**
 * A thin bar along the top edge while the next page loads. It waits a moment
 * before showing, so instant navigations never flash it, and it is purely
 * visual: the page's own skeleton announces "Carregando…" to screen readers.
 */
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  )
}
