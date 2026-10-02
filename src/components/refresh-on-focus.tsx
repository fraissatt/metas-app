'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const MIN_INTERVAL_MS = 60_000

// The header summary is rendered on the server, and soft navigations reuse the
// layout. Refreshing when the tab or window regains attention keeps "3 de 5
// hoje" correct across day rollover and edits made elsewhere.
export function RefreshOnFocus() {
  const router = useRouter()
  const lastRefresh = useRef(0)

  useEffect(() => {
    function refresh() {
      const now = Date.now()
      if (now - lastRefresh.current < MIN_INTERVAL_MS) return
      lastRefresh.current = now
      router.refresh()
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [router])

  return null
}
