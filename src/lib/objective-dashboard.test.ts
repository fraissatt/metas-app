import { describe, expect, it } from 'vitest'
import { calendarWeeks, overview, recentRate, streak, timeline } from '@/lib/objective-dashboard'
import type { ObjectiveWeek } from '@/lib/objectives'
import { parseDay } from '@/lib/dates'

// Thursday 2026-10-01; its week starts Monday 2026-09-28.
const now = new Date('2026-10-01T15:00:00-03:00')

function week(y: number, m: number, d: number, completed: number, total: number, fulfilled = completed === total && total > 0): ObjectiveWeek {
  // 03:00 rather than midnight: matching must use the calendar date, not the timestamp.
  return { weekStart: new Date(y, m, d, 3), completed, total, fulfilled }
}

describe('calendarWeeks', () => {
  it('returns 8 calendar weeks ending at the current one, filling weeks without goals', () => {
    const weeks = calendarWeeks([week(2026, 8, 28, 2, 4), week(2026, 8, 14, 5, 5)], now)

    expect(weeks).toHaveLength(8)
    expect(weeks[7].weekStart.getDate()).toBe(28)
    expect(weeks[7]).toMatchObject({ completed: 2, total: 4, percent: 50, hasGoal: true, current: true, fulfilled: false })
    expect(weeks[6]).toMatchObject({ hasGoal: false, total: 0, percent: 0, current: false })
    expect(weeks[5]).toMatchObject({ percent: 100, fulfilled: true, hasGoal: true })
    expect(weeks[0].weekStart.getDate()).toBe(10) // 2026-08-10
    expect(weeks.every((w) => w.weekStart.getDay() === 1)).toBe(true)
  })

  it('merges two entries that fall in the same calendar week', () => {
    const a = week(2026, 8, 28, 1, 2, false)
    const b = { ...week(2026, 8, 28, 3, 3, true), weekStart: new Date('2026-09-28T20:00:00-03:00') }
    const [, , , , , , , current] = calendarWeeks([a, b], now)
    expect(current).toMatchObject({ completed: 4, total: 5, percent: 80, fulfilled: false, hasGoal: true })
    const both = calendarWeeks([week(2026, 8, 28, 2, 2), { ...week(2026, 8, 28, 3, 3), weekStart: new Date('2026-09-28T20:00:00-03:00') }], now)
    expect(both[7]).toMatchObject({ completed: 5, total: 5, fulfilled: true })
  })

  it('accepts a custom count', () => {
    expect(calendarWeeks([], now, 3)).toHaveLength(3)
  })
})

describe('streak', () => {
  it('counts consecutive fulfilled weeks before the current one', () => {
    const weeks = [week(2026, 8, 7, 3, 3), week(2026, 8, 14, 3, 3), week(2026, 8, 21, 4, 4), week(2026, 8, 28, 1, 4)]
    expect(streak(weeks, now)).toBe(3)
  })

  it('counts the current week when it is already fulfilled', () => {
    const weeks = [week(2026, 8, 21, 4, 4), week(2026, 8, 28, 4, 4)]
    expect(streak(weeks, now)).toBe(2)
  })

  it('is broken by a week without a goal', () => {
    const weeks = [week(2026, 8, 7, 3, 3), week(2026, 8, 21, 4, 4)]
    expect(streak(weeks, now)).toBe(1)
  })

  it('is broken by an unfulfilled week', () => {
    const weeks = [week(2026, 8, 14, 3, 3), week(2026, 8, 21, 2, 4)]
    expect(streak(weeks, now)).toBe(0)
  })

  it('is zero without history', () => {
    expect(streak([], now)).toBe(0)
  })
})

describe('recentRate', () => {
  it('pools task counts across weeks instead of averaging percentages', () => {
    const weeks = calendarWeeks([week(2026, 8, 28, 1, 1), week(2026, 8, 21, 0, 9)], now)
    expect(recentRate(weeks)).toBe(10)
  })

  it('is null when nothing was planned', () => {
    expect(recentRate(calendarWeeks([], now))).toBeNull()
  })
})

describe('timeline', () => {
  it('reports how much of the window has elapsed', () => {
    const t = timeline(new Date('2026-09-01T15:00:00-03:00'), new Date('2026-10-31T15:00:00-03:00'), now)
    expect(t).toMatchObject({ kind: 'dated', overdue: false })
    expect(t.kind === 'dated' && t.elapsedPercent).toBe(50)
  })

  it('treats the whole target day as inside the deadline', () => {
    const target = parseDay('2026-10-01')
    const start = parseDay('2026-09-01')
    expect(timeline(start, target, new Date('2026-10-01T15:00:00-03:00'))).toMatchObject({ overdue: false })
    expect(timeline(start, target, new Date('2026-10-02T00:00:01-03:00'))).toMatchObject({ overdue: true })
  })

  it('clamps to 100 and flags an overdue target', () => {
    const t = timeline(parseDay('2026-01-01'), parseDay('2026-06-01'), now)
    expect(t).toMatchObject({ kind: 'dated', elapsedPercent: 100, overdue: true })
  })

  it('never divides by zero when the target is not after the start', () => {
    const t = timeline(parseDay('2026-10-01'), parseDay('2026-10-01'), now)
    expect(t.kind === 'dated' && Number.isFinite(t.elapsedPercent)).toBe(true)
  })

  it('counts active weeks when there is no target date', () => {
    expect(timeline(parseDay('2026-09-14'), null, now)).toEqual({ kind: 'open', weeksActive: 3 })
    expect(timeline(parseDay('2026-10-01'), null, now)).toEqual({ kind: 'open', weeksActive: 1 })
  })
})

describe('overview', () => {
  it('sums fulfilled weeks and pools the 8-week rate across active objectives', () => {
    const base = { description: null, targetDate: null, status: 'ACTIVE' as const, completedAt: null, createdAt: now, startDate: now, userId: 'test-user' }
    const result = overview(
      [
        { ...base, id: 'a', title: 'A', stats: { weeksFulfilled: 3, tasksCompleted: 0, weeksSinceStart: 1, recentWeeks: [week(2026, 8, 28, 3, 4)] } },
        { ...base, id: 'b', title: 'B', stats: { weeksFulfilled: 2, tasksCompleted: 0, weeksSinceStart: 1, recentWeeks: [week(2026, 8, 21, 1, 6)] } },
      ],
      now,
    )
    expect(result).toEqual({ activeCount: 2, weeksFulfilled: 5, recentRate: 40 })
  })

  it('has no rate when nothing was planned', () => {
    expect(overview([], now)).toEqual({ activeCount: 0, weeksFulfilled: 0, recentRate: null })
  })
})
