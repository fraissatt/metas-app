'use client'

import { createContext, useContext, useSyncExternalStore } from 'react'
import type { CardProgressStore } from '@/lib/card-progress'

const CardProgressContext = createContext<CardProgressStore | null>(null)

export const CardProgressProvider = CardProgressContext.Provider

const noopSubscribe = () => () => {}

/**
 * How far card `index` has entered the window, 0 to 1; always 1 without a
 * provider and on the server, so the final numbers are what the page starts with.
 */
export function useCardProgress(index: number): number {
  const store = useContext(CardProgressContext)
  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    () => (store ? store.get(index) : 1),
    () => 1,
  )
}
