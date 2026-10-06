import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  APP_TIME_ZONE,
  addAppDays,
  appDayOfMonth,
  appToday,
  differenceInAppWeeks,
  endOfAppDay,
  formatDate,
  formatDayKey,
  formatDayMonth,
  getWeekBounds,
  getWeekDays,
  isSameAppDay,
  parseDay,
  startOfAppDay,
} from '@/lib/dates'

// Every expectation here must hold under TZ=UTC (Vercel) and TZ=America/Sao_Paulo
// (local machines): run `npm run test:tz`.

afterEach(() => vi.useRealTimers())

describe('Brasília calendar', () => {
  it('uses America/Sao_Paulo', () => {
    expect(APP_TIME_ZONE).toBe('America/Sao_Paulo')
  })

  it('a day key means 00:00 in Brasília', () => {
    expect(parseDay('2026-10-05').toISOString()).toBe('2026-10-05T03:00:00.000Z')
    expect(formatDayKey(parseDay('2026-10-05'))).toBe('2026-10-05')
  })

  it('round-trips day keys across old DST offsets and year ends', () => {
    for (const key of ['2018-11-04', '2018-02-17', '2025-12-31', '2026-01-01']) {
      expect(formatDayKey(parseDay(key))).toBe(key)
    }
  })

  it('rejects invalid keys', () => {
    expect(() => parseDay('nope')).toThrow(RangeError)
  })

  it('"today" is the Brasília day even after 21:00 when UTC has rolled over', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-07T01:30:00Z')) // 22:30 on 06/10 in Brasília
    expect(formatDayKey(appToday())).toBe('2026-10-06')
  })

  it('week bounds and days follow Brasília, Monday first', () => {
    const { weekStart, weekEnd } = getWeekBounds(parseDay('2026-10-07'))
    expect(formatDayKey(weekStart)).toBe('2026-10-05')
    expect(formatDayKey(weekEnd)).toBe('2026-10-11')
    expect(getWeekDays(weekStart).map(appDayOfMonth)).toEqual([5, 6, 7, 8, 9, 10, 11])
  })

  it('keeps a Monday as its own week start, and Sunday in the same week', () => {
    expect(formatDayKey(getWeekBounds(parseDay('2026-07-27')).weekStart)).toBe('2026-07-27')
    expect(formatDayKey(getWeekBounds(parseDay('2026-08-02')).weekStart)).toBe('2026-07-27')
  })

  it('builds weeks across a year boundary', () => {
    const days = getWeekDays(getWeekBounds(parseDay('2025-12-31')).weekStart).map(formatDayKey)
    expect(days[0]).toBe('2025-12-29')
    expect(days[6]).toBe('2026-01-04')
  })

  it('compares and steps days in Brasília', () => {
    const d = parseDay('2026-10-05')
    expect(isSameAppDay(d, new Date('2026-10-06T02:59:00Z'))).toBe(true)
    expect(isSameAppDay(d, new Date('2026-10-06T03:00:00Z'))).toBe(false)
    expect(formatDayKey(addAppDays(d, 1))).toBe('2026-10-06')
    expect(startOfAppDay(new Date('2026-10-06T01:00:00Z')).toISOString()).toBe('2026-10-05T03:00:00.000Z')
    expect(endOfAppDay(d).toISOString()).toBe('2026-10-06T02:59:59.999Z')
    expect(differenceInAppWeeks(parseDay('2026-10-12'), parseDay('2026-10-05'))).toBe(1)
  })

  it('displays in Brasília', () => {
    expect(formatDayMonth(new Date('2026-10-05T03:00:00Z'))).toBe('05/10')
    expect(formatDayMonth(new Date('2026-10-06T02:00:00Z'))).toBe('05/10')
    expect(formatDate(parseDay('2026-07-29'))).toBe('29/07/2026')
    expect(formatDayMonth(parseDay('2026-01-05'))).toBe('05/01')
  })
})
