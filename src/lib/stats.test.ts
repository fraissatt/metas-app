import { describe, expect, it } from 'vitest'
import { buildWeekWindow } from '@/lib/stats'
import { parseDay } from '@/lib/dates'

// Dates use the local-time constructor `new Date(year, monthIndex, day, …)`
// rather than ISO strings on purpose: `parseDay('2026-08-17')` parses as UTC
// midnight, which lands on Aug 16 in any negative-offset timezone and would
// make these week-boundary assertions pass or fail depending on where the
// suite runs. Month index is 0-based, so 7 is August.
//
// Reference calendar: 2026-08-19 is a Wednesday, so the current week starts
// Monday 2026-08-17. Earlier Mondays: 08-10, 08-03, 07-27, …, 06-29.
const NOW = new Date('2026-08-19T12:00:00-03:00')

describe('buildWeekWindow', () => {
  it('returns an empty window when nothing has ever been completed', () => {
    expect(buildWeekWindow([], NOW)).toEqual([])
  })

  it('returns a single active week when the only completion is in the current week', () => {
    const window = buildWeekWindow([new Date('2026-08-18T09:00:00-03:00')], NOW)

    expect(window).toHaveLength(1)
    expect(window[0].weekStart).toEqual(parseDay('2026-08-17'))
    expect(window[0].active).toBe(true)
  })

  it('spans from the earliest completion to the current week, oldest first, marking gaps inactive', () => {
    const window = buildWeekWindow(
      [
        new Date('2026-08-04T10:00:00-03:00'), // Tuesday of the week of 08-03
        new Date('2026-08-18T10:00:00-03:00'), // Tuesday of the week of 08-17
      ],
      NOW,
    )

    expect(window.map((w) => w.weekStart)).toEqual([
      parseDay('2026-08-03'),
      parseDay('2026-08-10'),
      parseDay('2026-08-17'),
    ])
    // Nothing was completed in the week of 08-10 — it is a gap, not a break.
    expect(window.map((w) => w.active)).toEqual([true, false, true])
  })

  it('caps the window at maxWeeks, keeping the most recent weeks', () => {
    const window = buildWeekWindow([new Date('2026-01-05T10:00:00-03:00')], NOW, 8)

    expect(window).toHaveLength(8)
    expect(window[0].weekStart).toEqual(parseDay('2026-06-29')) // 7 weeks before 08-17
    expect(window[7].weekStart).toEqual(parseDay('2026-08-17'))
    // The January completion falls outside the capped window entirely.
    expect(window.every((w) => !w.active)).toBe(true)
  })

  it('splits Sunday 23:59 and Monday 00:00 into different weeks', () => {
    const sundayNight = new Date('2026-08-16T23:59:00-03:00') // last minute of the week of 08-10
    const mondayMorning = new Date('2026-08-17T00:00:00-03:00') // first minute of the week of 08-17

    const window = buildWeekWindow([sundayNight, mondayMorning], NOW)

    expect(window.map((w) => w.weekStart)).toEqual([parseDay('2026-08-10'), parseDay('2026-08-17')])
    expect(window.map((w) => w.active)).toEqual([true, true])
  })
})
