import { describe, expect, it } from 'vitest'
import { scrollProgress, viewWeights } from '@/lib/scroll-progress'

// Step centres in window coordinates, top to bottom; scrolling down moves them up.
const centers = [600, 1000, 1400]

describe('scrollProgress', () => {
  it('is 0 while the first step has not reached the reference line', () => {
    expect(scrollProgress(centers, 300)).toBe(0)
    expect(scrollProgress(centers, 600)).toBe(0)
  })

  it('is the index of a step when its centre is on the reference line', () => {
    expect(scrollProgress(centers, 1000)).toBe(1)
    expect(scrollProgress(centers, 1400)).toBe(2)
  })

  it('moves linearly between two steps', () => {
    expect(scrollProgress(centers, 800)).toBeCloseTo(0.5)
    expect(scrollProgress(centers, 700)).toBeCloseTo(0.25)
    expect(scrollProgress(centers, 1300)).toBeCloseTo(1.75)
  })

  it('stops at the last step', () => {
    expect(scrollProgress(centers, 2000)).toBe(2)
  })

  it('handles one step and no steps', () => {
    expect(scrollProgress([500], 900)).toBe(0)
    expect(scrollProgress([], 900)).toBe(0)
  })
})

describe('viewWeights', () => {
  it('shows only the first view at progress 0', () => {
    expect(viewWeights(0, 3, false)).toEqual([1, 0, 0])
  })

  it('cross-fades between two views: the weights of the neighbours add up to 1', () => {
    const [a, b, c] = viewWeights(0.25, 3, false)
    expect(a).toBeCloseTo(0.75)
    expect(b).toBeCloseTo(0.25)
    expect(c).toBe(0)
    expect(a + b).toBeCloseTo(1)
  })

  it('is exactly one view at each step', () => {
    expect(viewWeights(1, 3, false)).toEqual([0, 1, 0])
    expect(viewWeights(2, 3, false)).toEqual([0, 0, 1])
  })

  it('switches at once, with no blending, when motion is reduced', () => {
    expect(viewWeights(0.4, 3, true)).toEqual([1, 0, 0])
    expect(viewWeights(0.6, 3, true)).toEqual([0, 1, 0])
    expect(viewWeights(1.5, 3, true)).toEqual([0, 0, 1])
  })

  it('rounds the weights so the CSS values stay short', () => {
    for (const weight of viewWeights(0.123456789, 3, false)) {
      expect(String(weight).length).toBeLessThanOrEqual(5)
    }
  })
})
