/**
 * How far a card has entered the window, 0 to 1: 0 while its top is at (or
 * below) the bottom edge, 1 once its top is 70% of the window height up.
 */
export function cardProgress(top: number, windowHeight: number): number {
  return Math.min(1, Math.max(0, (windowHeight - top) / (windowHeight * 0.7)))
}

export type CardProgressStore = {
  get(index: number): number
  set(index: number, value: number): void
  subscribe(listener: () => void): () => void
}

/**
 * A tiny external store of per-card progress, so only the numbers and bars that
 * depend on a card re-render while scrolling. Values are clamped and rounded to
 * steps of 0.02, which keeps the renders to about fifty per card per pass.
 * Cards start at `initial` (1 by default: the final numbers, for a page that
 * has not run its scripts).
 */
export function createCardProgress(count: number, initial = 1): CardProgressStore {
  const values = Array.from({ length: count }, () => initial)
  const listeners = new Set<() => void>()
  return {
    get: (index) => values[index] ?? 1,
    set(index, value) {
      const next = Math.round(Math.min(1, Math.max(0, value)) * 50) / 50
      if (values[index] === next) return
      values[index] = next
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
