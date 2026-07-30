import { describe, expect, it } from 'vitest'
import { getWeekBounds } from '@/lib/dates'

describe('getWeekBounds', () => {
  it('returns Monday through Sunday for a mid-week date', () => {
    const wednesday = new Date('2026-07-29T12:00:00')
    const { weekStart, weekEnd } = getWeekBounds(wednesday)

    expect(weekStart.getDay()).toBe(1) // Monday
    expect(weekStart.getDate()).toBe(27)
    expect(weekEnd.getDay()).toBe(0) // Sunday
    expect(weekEnd.getDate()).toBe(2) // Aug 2
  })

  it('keeps a Monday as its own week start', () => {
    const monday = new Date('2026-07-27T09:00:00')
    const { weekStart } = getWeekBounds(monday)

    expect(weekStart.getDate()).toBe(27)
  })
})
