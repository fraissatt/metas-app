'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { msUntilNextAppDay } from '@/lib/dates'

const MIN_INTERVAL_MS = 60_000
// Covers a client clock a few seconds ahead of the server's.
const ROLLOVER_SLACK_MS = 5_000

// The header summary is rendered on the server, and soft navigations reuse the
// layout. Refreshing when the tab or window regains attention keeps "3 de 5
// hoje" correct across day rollover and edits made elsewhere. A page left
// open through midnight (Brasília) also refreshes by itself when the day
// turns, so Hoje never keeps showing yesterday's list.
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
    // A little past midnight, so the server is surely on the new day. A
    // hidden tab's timer may fire late; the visibility refresh covers that.
    let timer: ReturnType<typeof setTimeout>
    function scheduleRollover() {
      timer = setTimeout(() => {
        lastRefresh.current = Date.now()
        router.refresh()
        scheduleRollover()
      }, msUntilNextAppDay() + ROLLOVER_SLACK_MS)
    }
    scheduleRollover()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [router])

  return null
}
