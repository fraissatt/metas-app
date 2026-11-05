import { describe, expect, it } from 'vitest'
import { IDEAL_GOAL, buildPaceSeries, type PaceTask } from '@/lib/pace'
import { parseDay } from '@/lib/dates'

// Calendar: 2026-08-03 is a Monday. The objective runs 4 weeks, 08-03 → 08-30
// (28 days, indices 0..27). Days are Brasília days built with parseDay, so the
// assertions mean the same under any machine time zone (npm run test:tz).
const START = parseDay('2026-08-03')
const TARGET = parseDay('2026-08-30')

function task(date: string, completedAt?: string | null, completed = completedAt !== undefined && completedAt !== null): PaceTask {
  return { date: parseDay(date), completed, completedAt: completedAt ? new Date(completedAt) : null }
}

const base = { startDate: START, targetDate: TARGET, completedAt: null }

describe('buildPaceSeries', () => {
  it('returns null when the objective has no tasks', () => {
    expect(buildPaceSeries({ ...base, tasks: [], today: parseDay('2026-08-10') })).toBeNull()
  })

  it('ideal ends at 93% on the last day of the range', () => {
    const result = buildPaceSeries({
      ...base,
      tasks: [task('2026-08-03'), task('2026-08-10'), task('2026-08-17'), task('2026-08-24')],
      today: parseDay('2026-08-10'),
    })!

    expect(IDEAL_GOAL).toBe(0.93)
    expect(result.points).toHaveLength(28)
    expect(result.points.at(-1)!.day).toEqual(TARGET)
    expect(result.points.at(-1)!.ideal).toBeCloseTo(93)
  })

  it('ideal follows the plan: a week with more tasks lifts it more than a lighter week', () => {
    const result = buildPaceSeries({
      ...base,
      tasks: [task('2026-08-03'), task('2026-08-04'), ...Array.from({ length: 6 }, () => task('2026-08-12'))],
      today: parseDay('2026-08-10'),
    })!
    const ideal = (day: string) => result.points.find((p) => p.day.getTime() === parseDay(day).getTime())!.ideal

    // Week 1 holds 2 of the 8 tasks, week 2 holds 6.
    expect(ideal('2026-08-09') - ideal('2026-08-03')).toBeLessThan(ideal('2026-08-16') - ideal('2026-08-09'))
  })

  it('real never decreases and stays flat across a day without completions', () => {
    const result = buildPaceSeries({
      ...base,
      tasks: [task('2026-08-03', '2026-08-04T12:00:00-03:00'), task('2026-08-10'), task('2026-08-17')],
      today: parseDay('2026-08-12'),
    })!
    const real = result.points.map((p) => p.real).filter((v): v is number => v !== null)

    expect(real.every((value, i) => i === 0 || value >= real[i - 1])).toBe(true)
    expect(real[5]).toBe(real[4]) // 08-08 vs 08-07: nothing completed in between
  })

  it('real counts a task on the day of completedAt, not its scheduled date', () => {
    const result = buildPaceSeries({
      ...base,
      tasks: [task('2026-08-03', '2026-08-06T10:00:00-03:00'), task('2026-08-10')],
      today: parseDay('2026-08-10'),
    })!
    const real = (day: string) => result.points.find((p) => p.day.getTime() === parseDay(day).getTime())!.real

    expect(real('2026-08-05')).toBe(0)
    expect(real('2026-08-06')).toBe(50)
  })

  it('a completed task without completedAt falls back to its scheduled date', () => {
    const result = buildPaceSeries({
      ...base,
      tasks: [task('2026-08-04', null, true), task('2026-08-20')],
      today: parseDay('2026-08-10'),
    })!

    expect(result.summary.donePercent).toBe(50)
  })

  it('a task completed at 23:30 Brasília counts on that day', () => {
    const result = buildPaceSeries({
      ...base,
      tasks: [task('2026-08-03', '2026-08-05T23:30:00-03:00'), task('2026-08-20')],
      today: parseDay('2026-08-10'),
    })!
    const real = (day: string) => result.points.find((p) => p.day.getTime() === parseDay(day).getTime())!.real

    expect(real('2026-08-04')).toBe(0)
    expect(real('2026-08-05')).toBe(50)
  })

  it("projection starts at today's real value and uses the last 14 days' pace", () => {
    // 10 tasks, 2 done before today (day index 9; the pace window is the 9 days before it): 2 tasks / 9 days of a 10-task plan.
    const tasks = [
      task('2026-08-03', '2026-08-04T10:00:00-03:00'),
      task('2026-08-05', '2026-08-06T10:00:00-03:00'),
      ...Array.from({ length: 8 }, () => task('2026-08-20')),
    ]
    const result = buildPaceSeries({ ...base, tasks, today: parseDay('2026-08-12') })!
    const todayPoint = result.points.find((p) => p.day.getTime() === parseDay('2026-08-12').getTime())!

    expect(todayPoint.real).toBe(20)
    expect(todayPoint.projection).toBe(20)
    expect(result.points.at(-1)!.projection).toBeCloseTo(60)
    expect(result.summary.projectedPercent).toBeCloseTo(60)
  })

  it('projection is capped at 100', () => {
    const tasks = [
      ...Array.from({ length: 8 }, () => task('2026-08-03', '2026-08-04T10:00:00-03:00')),
      task('2026-08-25'),
      task('2026-08-26'),
    ]
    const result = buildPaceSeries({ ...base, tasks, today: parseDay('2026-08-10') })!

    expect(result.points.at(-1)!.projection).toBe(100)
  })

  it('real is null and projection set only after today', () => {
    const result = buildPaceSeries({
      ...base,
      tasks: [task('2026-08-03'), task('2026-08-24')],
      today: parseDay('2026-08-10'),
    })!
    const before = result.points.find((p) => p.day.getTime() === parseDay('2026-08-09').getTime())!
    const after = result.points.find((p) => p.day.getTime() === parseDay('2026-08-11').getTime())!

    expect(before.projection).toBeNull()
    expect(after.real).toBeNull()
    expect(after.projection).not.toBeNull()
  })

  it('no targetDate: the range ends at the last planned task', () => {
    const result = buildPaceSeries({
      ...base,
      targetDate: null,
      tasks: [task('2026-08-03'), task('2026-08-14')],
      today: parseDay('2026-08-05'),
    })!

    expect(result.points.at(-1)!.day).toEqual(parseDay('2026-08-14'))
    expect(result.points.at(-1)!.ideal).toBeCloseTo(93)
  })

  it('completed objective: projection is null on every point and real stops at completedAt', () => {
    const result = buildPaceSeries({
      ...base,
      completedAt: new Date('2026-08-12T10:00:00-03:00'),
      tasks: [task('2026-08-03', '2026-08-05T10:00:00-03:00'), task('2026-08-10', '2026-08-12T09:00:00-03:00')],
      today: parseDay('2026-08-20'),
    })!
    const day = (d: string) => result.points.find((p) => p.day.getTime() === parseDay(d).getTime())!

    expect(result.points.every((p) => p.projection === null)).toBe(true)
    expect(day('2026-08-12').real).toBe(100)
    expect(day('2026-08-13').real).toBeNull()
    expect(result.summary.projectedPercent).toBeNull()
  })

  it('today after the end is clamped to the end; before the start to the start', () => {
    const tasks = [task('2026-08-03', '2026-08-04T10:00:00-03:00'), task('2026-08-24')]
    const late = buildPaceSeries({ ...base, tasks, today: parseDay('2026-09-20') })!
    const early = buildPaceSeries({ ...base, tasks, today: parseDay('2026-07-01') })!

    expect(late.points.at(-1)!.real).toBe(50)
    expect(late.summary.projectedPercent).toBe(50) // today is the last day: nothing left to project
    expect(early.points[0].real).toBe(0)
    expect(early.summary.donePercent).toBe(0)
    expect(early.summary.projectedPercent).toBeNull() // today is the first day: no history yet
  })

  it('tasks completed after the range end still count, on the last day', () => {
    const result = buildPaceSeries({
      ...base,
      tasks: [task('2026-08-24', '2026-09-03T10:00:00-03:00')],
      today: parseDay('2026-09-10'),
    })!

    expect(result.summary.donePercent).toBe(100)
  })

  it('summary.gapPoints is the distance below the ideal and 0 when ahead', () => {
    const behind = buildPaceSeries({
      ...base,
      tasks: [task('2026-08-03'), task('2026-08-04'), task('2026-08-05'), task('2026-08-06')],
      today: parseDay('2026-08-10'),
    })!
    const ahead = buildPaceSeries({
      ...base,
      tasks: [
        task('2026-08-03', '2026-08-03T10:00:00-03:00'),
        task('2026-08-24', '2026-08-04T10:00:00-03:00'),
      ],
      today: parseDay('2026-08-10'),
    })!

    expect(behind.summary.gapPoints).toBeCloseTo(93)
    expect(ahead.summary.gapPoints).toBe(0)
  })

  it('tasksPerWeekToCatchUp is null on pace and a positive whole number when the projection falls short', () => {
    const onPace = buildPaceSeries({
      ...base,
      tasks: [task('2026-08-03', '2026-08-03T10:00:00-03:00'), task('2026-08-04', '2026-08-04T10:00:00-03:00')],
      today: parseDay('2026-08-10'),
    })!
    const short = buildPaceSeries({
      ...base,
      tasks: [task('2026-08-03', '2026-08-04T10:00:00-03:00'), ...Array.from({ length: 9 }, () => task('2026-08-20'))],
      today: parseDay('2026-08-12'),
    })!

    expect(onPace.summary.tasksPerWeekToCatchUp).toBeNull()
    // Projection ends at 30%; the ideal needs 63 more points = 6.3 tasks over 18 days (2.57 weeks) → 3 a week.
    expect(short.summary.tasksPerWeekToCatchUp).toBe(3)
  })

  it('a user who did every task through yesterday is not behind in the morning', () => {
    // 28 tasks, one a day from 08-03; 9 done (08-03 → 08-11), today is 08-12 and its task is still open.
    const tasks = Array.from({ length: 28 }, (_, i) => {
      const date = parseDay('2026-08-03')
      date.setUTCDate(date.getUTCDate() + i)
      const key = new Date(date.getTime() - 3 * 3600_000).toISOString().slice(0, 10)
      return i < 9 ? task(key, key + 'T10:00:00-03:00') : task(key)
    })
    const result = buildPaceSeries({ ...base, tasks, today: parseDay('2026-08-12') })!

    expect(result.summary.gapPoints).toBe(0)
  })

  it('on the first day there is no projection and no nudge', () => {
    const result = buildPaceSeries({
      ...base,
      tasks: Array.from({ length: 28 }, () => task('2026-08-03')),
      today: START,
    })!

    expect(result.points.every((p) => p.projection === null)).toBe(true)
    expect(result.summary.projectedPercent).toBeNull()
    expect(result.summary.tasksPerWeekToCatchUp).toBeNull()
  })

  it('hides the weekly nudge when less than a week is left', () => {
    const tasks = [task('2026-08-03', '2026-08-04T10:00:00-03:00'), ...Array.from({ length: 27 }, () => task('2026-08-28'))]
    const result = buildPaceSeries({ ...base, tasks, today: parseDay('2026-08-29') })!

    expect(result.summary.projectedPercent).not.toBeNull()
    expect(result.summary.tasksPerWeekToCatchUp).toBeNull()
  })

  it('a task completed before the start counts on the first day', () => {
    const result = buildPaceSeries({
      ...base,
      tasks: [task('2026-08-03', '2026-07-30T10:00:00-03:00'), task('2026-08-24')],
      today: parseDay('2026-08-10'),
    })!

    expect(result.points[0].real).toBe(50)
  })
})
