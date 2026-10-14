import { describe, expect, it } from 'vitest'
import { appToday, differenceInAppDays, formatDayKey, getWeekBounds, isSameAppDay } from '@/lib/dates'
import { buildLandingDemo } from '@/lib/landing-demo'

// Wednesday 14/10/2026 at 12:00 in Brasília.
const WEDNESDAY = new Date('2026-10-14T15:00:00Z')
// Monday 12/10/2026 at 02:08 UTC is still Sunday 11/10 (23:08) in Brasília.
const SUNDAY_NIGHT = new Date('2026-10-12T02:08:00Z')
const MONDAY = new Date('2026-10-12T15:00:00Z')

const todaysTasks = (now: Date) => {
  const today = appToday(now)
  return buildLandingDemo(now).goals.flatMap((goal) => goal.dailyTasks.filter((task) => isSameAppDay(task.date, today)))
}

describe('buildLandingDemo', () => {
  it('builds one active objective whose goals all belong to it and to the current week', () => {
    const { objective, goals } = buildLandingDemo(WEDNESDAY)
    const { weekStart } = getWeekBounds(appToday(WEDNESDAY))

    expect(objective.status).toBe('ACTIVE')
    expect(goals.length).toBeGreaterThanOrEqual(2)
    for (const goal of goals) {
      expect(goal.objective.id).toBe(objective.id)
      expect(goal.objectiveId).toBe(objective.id)
      expect(formatDayKey(goal.weekStart)).toBe(formatDayKey(weekStart))
    }
  })

  it('carries the Brasília day it was built for, so views never read the clock themselves', () => {
    expect(formatDayKey(buildLandingDemo(WEDNESDAY).today)).toBe('2026-10-14')
    expect(formatDayKey(buildLandingDemo(SUNDAY_NIGHT).today)).toBe('2026-10-11')
  })

  it('marks the days before today as done and leaves today and later open', () => {
    const today = appToday(WEDNESDAY)
    for (const goal of buildLandingDemo(WEDNESDAY).goals) {
      for (const task of goal.dailyTasks) {
        const past = differenceInAppDays(today, task.date) > 0
        expect(task.completed, `${goal.title} ${formatDayKey(task.date)}`).toBe(past)
      }
    }
  })

  it('gives every goal at least one open task today, on any weekday', () => {
    for (const now of [WEDNESDAY, SUNDAY_NIGHT, MONDAY, new Date('2026-10-18T15:00:00Z')]) {
      const demo = buildLandingDemo(now)
      for (const goal of demo.goals) {
        const today = appToday(now)
        const open = goal.dailyTasks.filter((task) => isSameAppDay(task.date, today) && !task.completed)
        expect(open.length, `${goal.title} on ${now.toISOString()}`).toBeGreaterThan(0)
      }
    }
  })

  it('follows the Brasília calendar, not the machine clock, around midnight UTC', () => {
    const { weekStart } = getWeekBounds(appToday(SUNDAY_NIGHT))
    expect(formatDayKey(weekStart)).toBe('2026-10-05')
    expect(todaysTasks(SUNDAY_NIGHT).every((task) => formatDayKey(task.date) === '2026-10-11')).toBe(true)
  })

  it('has six earlier weeks, oldest first, ending right before the current one, with 5 fulfilled and a streak of 4', () => {
    const { weeks } = buildLandingDemo(WEDNESDAY)
    const { weekStart } = getWeekBounds(appToday(WEDNESDAY))
    expect(weeks).toHaveLength(6)
    expect(differenceInAppDays(weekStart, weeks[5].weekStart)).toBe(7)
    for (let i = 1; i < weeks.length; i++) expect(weeks[i].weekStart > weeks[i - 1].weekStart).toBe(true)
    expect(weeks.every((week) => week.rate >= 0 && week.rate <= 1)).toBe(true)
    expect(weeks.filter((week) => week.rate === 1)).toHaveLength(5)
    expect(weeks.map((week) => week.rate).slice(-4)).toEqual([1, 1, 1, 1])
  })

  it('uses unique ids and never leaves a task outside its goal week', () => {
    const { goals } = buildLandingDemo(WEDNESDAY)
    const ids = goals.flatMap((goal) => [goal.id, ...goal.dailyTasks.map((task) => task.id)])
    expect(new Set(ids).size).toBe(ids.length)
    for (const goal of goals) {
      for (const task of goal.dailyTasks) {
        expect(task.weeklyGoalId).toBe(goal.id)
        expect(task.date >= goal.weekStart && task.date <= goal.weekEnd).toBe(true)
      }
    }
  })

  it('has an objective that started before this week and ends after it', () => {
    const { objective } = buildLandingDemo(WEDNESDAY)
    const today = appToday(WEDNESDAY)
    expect(differenceInAppDays(today, objective.startDate)).toBeGreaterThan(7)
    expect(objective.targetDate && differenceInAppDays(objective.targetDate, today)).toBeGreaterThan(7)
  })
})
