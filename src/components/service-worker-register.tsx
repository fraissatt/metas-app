'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker for everyone, not only for people who turn the
 * reminder on, so the offline page and the static-file cache are in place from
 * the first visit. Production only: in development the worker would cache
 * files whose names do not change.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
  }, [])

  return null
}
