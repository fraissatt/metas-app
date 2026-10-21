import { describe, expect, it } from 'vitest'
import { getMonthDays, getYearDays, parseDay } from '@/lib/dates'
import {
  buildDayDots,
  compoundFactor,
  countDaysDone,
  dayTone,
  formatFactor,
  layoutYearWeeks,
  monthFromDots,
} from '@/lib/day-dots'

describe('dayTone', () => {
  it('picks the tone from the share of the day done', () => {
    expect(dayTone(0, 0)).toBe('empty')
    expect(dayTone(0, 3)).toBe('empty')
    expect(dayTone(1, 3)).toBe('partial') // 33%
    expect(dayTone(5, 9)).toBe('partial') // 55,5%
    expect(dayTone(3, 5)).toBe('done') // exactly 60%
    expect(dayTone(4, 4)).toBe('done')
  })
})

describe('buildDayDots', () => {
  const now = new Date('2026-10-20T15:00:00Z')

  it('buckets tasks by their Brasília day and leaves the future empty', () => {
    const tasks = [
      { date: parseDay('2026-10-05'), completed: true },
      { date: parseDay('2026-10-05'), completed: false },
      { date: parseDay('2026-10-06'), completed: true },
      { date: parseDay('2026-10-25'), completed: true },
    ]
    const dots = buildDayDots(tasks, getMonthDays(parseDay('2026-10-01')), now)

    expect(dots).toHaveLength(31)
    expect(dots[4]).toEqual({ key: '2026-10-05', tone: 'partial', isCurrentDay: false })
    expect(dots[5].tone).toBe('done')
    expect(dots[19]).toEqual({ key: '2026-10-20', tone: 'empty', isCurrentDay: true })
    expect(dots[24].tone).toBe('empty') // future
  })

  it('keeps a task stored at 00:00 Brasília on that day, not the UTC one before', () => {
    // 00:00 in Brasília is 03:00Z; a UTC reading would still be on the same day,
    // but 23:30 Brasília (02:30Z next day) must stay on the earlier day.
    const late = new Date('2026-10-08T02:30:00Z')
    const dots = buildDayDots([{ date: late, completed: true }], getMonthDays(parseDay('2026-10-01')), now)
    expect(dots[6].tone).toBe('done') // Oct 7
    expect(dots[7].tone).toBe('empty') // Oct 8
  })
})

describe('countDaysDone', () => {
  it('counts days that reached the threshold, across years', () => {
    expect(
      countDaysDone([
        { date: parseDay('2025-03-01'), completed: true },
        { date: parseDay('2026-10-05'), completed: true },
        { date: parseDay('2026-10-05'), completed: false },
        { date: parseDay('2026-10-05'), completed: false },
      ]),
    ).toBe(1)
  })
})

describe('compound factor', () => {
  it('compounds 1% per day done and formats it in pt-BR', () => {
    expect(formatFactor(compoundFactor(0))).toBe('1,0×')
    expect(formatFactor(compoundFactor(70))).toBe('2,0×')
    expect(formatFactor(compoundFactor(365))).toBe('37,8×')
    expect(formatFactor(compoundFactor(730))).toBe('1.428×')
  })
})

describe('layoutYearWeeks', () => {
  it('lays the year out in Monday-first weeks', () => {
    const dots = buildDayDots([], getYearDays(2026), new Date('2026-10-20T15:00:00Z'))
    const weeks = layoutYearWeeks(dots)

    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(weeks[0].slice(0, 3)).toEqual([null, null, null]) // Jan 1 2026 is a Thursday
    expect(weeks[0][3]?.key).toBe('2026-01-01')
    expect(weeks.flat().filter(Boolean)).toHaveLength(365)
    expect(weeks.at(-1)?.at(-1)).toBeNull() // Dec 31 2026 is a Thursday
  })
})

describe('monthFromDots', () => {
  const now = new Date('2026-10-20T15:00:00Z')

  it('picks one month in order, with its real length', () => {
    const dots = buildDayDots([], getYearDays(2026), now)
    const february = monthFromDots(dots, 2026, 2)
    expect(february).toHaveLength(28)
    expect(february[0].key).toBe('2026-02-01')
    expect(february[27].key).toBe('2026-02-28')
    expect(monthFromDots(dots, 2026, 12)[30].key).toBe('2026-12-31')
  })

  it('has 29 days in a leap February', () => {
    expect(monthFromDots(buildDayDots([], getYearDays(2028), now), 2028, 2)).toHaveLength(29)
  })

  it('is empty for a month the dots do not cover', () => {
    expect(monthFromDots(buildDayDots([], getYearDays(2026), now), 2025, 6)).toEqual([])
  })
})
