'use client'

import { useRef, useState } from 'react'
import type { Theme } from '@/lib/theme'

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

/**
 * The current theme with an optimistic setter: the page repaints at once, saves
 * run one at a time in the order they were requested, and a failed save puts the
 * page back on the last theme the server confirmed.
 */
export function useTheme(initial: Theme, onChange: (theme: Theme) => Promise<void>) {
  const [theme, setThemeState] = useState<Theme>(initial)
  const confirmedTheme = useRef<Theme>(initial)
  const requestCounter = useRef<number>(0)
  const queue = useRef<Promise<void>>(Promise.resolve())

  async function save(next: Theme, id: number): Promise<void> {
    try {
      await onChange(next)
      confirmedTheme.current = next
    } catch {
      // Only revert if this is still the latest request
      if (id === requestCounter.current) {
        setThemeState(confirmedTheme.current)
        applyTheme(confirmedTheme.current)
      }
    }
  }

  function setTheme(next: Theme) {
    const requestId = ++requestCounter.current
    setThemeState(next)
    applyTheme(next)
    queue.current = queue.current.then(() => save(next, requestId))
  }

  return { theme, setTheme }
}
