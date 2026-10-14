import { describe, expect, it, vi } from 'vitest'
import { cardProgress, createCardProgress } from '@/lib/card-progress'

describe('cardProgress', () => {
  it('is 0 while the card is still below the window', () => {
    expect(cardProgress(800, 800)).toBe(0)
    expect(cardProgress(1200, 800)).toBe(0)
  })

  it('grows as the card moves up and is complete once its top is 70% of the window up', () => {
    expect(cardProgress(600, 800)).toBeCloseTo(200 / 560)
    expect(cardProgress(240, 800)).toBe(1)
    expect(cardProgress(-100, 800)).toBe(1)
  })
})

describe('createCardProgress', () => {
  it('starts at the given value, 1 by default, so a page without scripts shows the final numbers', () => {
    const store = createCardProgress(3)
    expect([store.get(0), store.get(1), store.get(2)]).toEqual([1, 1, 1])
    expect(createCardProgress(2, 0).get(1)).toBe(0)
  })

  it('stores a value clamped to 0..1 and rounded to steps of 0.02', () => {
    const store = createCardProgress(1)
    store.set(0, 0.3333)
    expect(store.get(0)).toBe(0.34)
    store.set(0, -4)
    expect(store.get(0)).toBe(0)
    store.set(0, 7)
    expect(store.get(0)).toBe(1)
  })

  it('tells subscribers only when the stored value changes', () => {
    const store = createCardProgress(1)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.set(0, 0.5)
    store.set(0, 0.501) // rounds to the same step
    expect(listener).toHaveBeenCalledTimes(1)
    store.set(0, 0.6)
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    store.set(0, 0.9)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('answers 1 for an index it does not know', () => {
    expect(createCardProgress(1).get(5)).toBe(1)
  })
})
