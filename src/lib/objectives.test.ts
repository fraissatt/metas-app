import { describe, expect, it } from 'vitest'
import { buildObjectiveWeeks, describeSchedule, isGoalFulfilled } from '@/lib/objectives'
import { parseDay } from '@/lib/dates'

// Local-time constructor, not ISO strings: `parseDay('2026-08-17')` is UTC
// midnight, which lands on Aug 16 in any negative-offset timezone. Month index
// is 0-based, so 7 is August.
const week = (monthIndex: number, day: number) => parseDay(`2026-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
const task = (completed: boolean) => ({ completed })

describe('isGoalFulfilled', () => {
  it('is true when every task is complete', () => {
    expect(isGoalFulfilled([task(true), task(true)])).toBe(true)
  })

  it('is false when any task is incomplete', () => {
    expect(isGoalFulfilled([task(true), task(false)])).toBe(false)
  })

  it('is false for a goal with no tasks at all', () => {
    // `every` on an empty array is vacuously true — a goal nobody planned
    // must not celebrate itself.
    expect(isGoalFulfilled([])).toBe(false)
  })
})

describe('buildObjectiveWeeks', () => {
  it('returns an empty list for no goals', () => {
    expect(buildObjectiveWeeks([])).toEqual([])
  })

  it('collapses several goals in the same week into one entry with summed totals', () => {
    const weeks = buildObjectiveWeeks([
      { weekStart: week(7, 17), dailyTasks: [task(true), task(false)] },
      { weekStart: week(7, 17), dailyTasks: [task(true)] },
    ])

    expect(weeks).toHaveLength(1)
    expect(weeks[0].total).toBe(3)
    expect(weeks[0].completed).toBe(2)
  })

  it('fulfils a week only when every goal in it is fulfilled', () => {
    const [mixed] = buildObjectiveWeeks([
      { weekStart: week(7, 17), dailyTasks: [task(true)] },
      { weekStart: week(7, 17), dailyTasks: [task(true), task(false)] },
    ])
    expect(mixed.fulfilled).toBe(false)

    const [all] = buildObjectiveWeeks([
      { weekStart: week(7, 17), dailyTasks: [task(true)] },
      { weekStart: week(7, 17), dailyTasks: [task(true), task(true)] },
    ])
    expect(all.fulfilled).toBe(true)
  })

  it('does not fulfil a week that holds a goal with no tasks', () => {
    const [entry] = buildObjectiveWeeks([
      { weekStart: week(7, 17), dailyTasks: [task(true)] },
      { weekStart: week(7, 17), dailyTasks: [] },
    ])

    expect(entry.fulfilled).toBe(false)
  })

  it('returns weeks oldest first regardless of input order', () => {
    const weeks = buildObjectiveWeeks([
      { weekStart: week(7, 17), dailyTasks: [task(true)] },
      { weekStart: week(7, 3), dailyTasks: [task(true)] },
      { weekStart: week(7, 10), dailyTasks: [task(false)] },
    ])

    expect(weeks.map((w) => w.weekStart)).toEqual([week(7, 3), week(7, 10), week(7, 17)])
    expect(weeks.map((w) => w.fulfilled)).toEqual([true, false, true])
  })
})

describe('describeSchedule', () => {
  it('returns null when no target date was ever set', () => {
    expect(describeSchedule(week(8, 12), null)).toBeNull()
  })

  it('describes finishing ahead of the target', () => {
    expect(describeSchedule(week(7, 17), week(8, 7))).toBe('3 semanas antes do previsto')
  })

  it('describes finishing behind the target', () => {
    expect(describeSchedule(week(8, 7), week(7, 17))).toBe('3 semanas depois do previsto')
  })

  it('uses the singular for one week', () => {
    expect(describeSchedule(week(7, 17), week(7, 24))).toBe('1 semana antes do previsto')
  })

  it('describes landing in the target week', () => {
    expect(describeSchedule(week(7, 17), week(7, 19))).toBe('na semana prevista')
  })
})
