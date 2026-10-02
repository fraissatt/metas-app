import { describe, expect, it } from 'vitest'
import { getWeekBounds, getWeekDays, formatDate, formatDayMonth } from '@/lib/dates'

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

describe('getWeekDays', () => {
  it('returns the 7 dates from Monday through Sunday', () => {
    const monday = new Date('2026-07-27T00:00:00')

    const days = getWeekDays(monday)

    expect(days).toHaveLength(7)
    expect(days[0].getDate()).toBe(27) // Mon Jul 27
    expect(days[1].getDate()).toBe(28) // Tue Jul 28
    expect(days[6].getDate()).toBe(2) // Sun Aug 2
  })
})

describe('formatDate', () => {
  it('formats a full pt-BR date', () => {
    expect(formatDate(new Date(2026, 6, 29))).toBe('29/07/2026')
  })
})

describe('formatDayMonth', () => {
  it('formats a pt-BR day and month without the year', () => {
    expect(formatDayMonth(new Date(2026, 0, 5))).toBe('05/01')
  })
})
