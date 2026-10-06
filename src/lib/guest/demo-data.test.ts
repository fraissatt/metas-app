import { describe, expect, it } from 'vitest'
import { isSameDay, startOfDay } from 'date-fns'
import { getWeekBounds } from '@/lib/dates'
import { buildDemoData } from '@/lib/guest/demo-data'

const NOW = new Date(2026, 9, 7, 15) // Wednesday 07/10/2026 15:00
const data = buildDemoData(NOW)
const currentWeek = getWeekBounds(NOW).weekStart

describe('buildDemoData', () => {
  it('has two active objectives and one completed with completedAt', () => {
    expect(data).toHaveLength(3)
    expect(data.filter((o) => o.status === 'ACTIVE')).toHaveLength(2)
    const done = data.find((o) => o.status === 'COMPLETED')!
    expect(done.completedAt).toBeInstanceOf(Date)
    expect(done.completedAt!.getTime()).toBeLessThan(NOW.getTime())
  })

  it('gives the active objectives 8 weeks: 7 past plus the current one', () => {
    for (const objective of data.filter((o) => o.status === 'ACTIVE')) {
      const weeks = objective.goals.map((g) => g.weekStart.getTime())
      expect(new Set(weeks).size).toBe(8)
      expect(objective.goals.some((g) => isSameDay(g.weekStart, currentWeek))).toBe(true)
    }
  })

  it('has one active objective near its target date', () => {
    const days = data
      .filter((o) => o.status === 'ACTIVE')
      .map((o) => (o.targetDate.getTime() - NOW.getTime()) / 86_400_000)
    expect(Math.min(...days)).toBeLessThanOrEqual(14)
    expect(Math.min(...days)).toBeGreaterThan(0)
  })

  it('never marks a future task as done, and stamps completedAt on done tasks', () => {
    for (const task of data.flatMap((o) => o.goals.flatMap((g) => g.tasks))) {
      if (task.date > startOfDay(NOW) && !isSameDay(task.date, NOW)) expect(task.completed).toBe(false)
      expect(task.completed).toBe(task.completedAt !== null)
      if (task.completedAt) expect(task.completedAt.getTime()).toBeLessThanOrEqual(NOW.getTime())
    }
  })

  it('has varied completion in past weeks (not all 100%)', () => {
    const past = data.flatMap((o) => o.goals).filter((g) => g.weekStart < currentWeek)
    const rates = past.map((g) => g.tasks.filter((t) => t.completed).length / g.tasks.length)
    expect(rates.some((r) => r === 1)).toBe(true)
    expect(rates.some((r) => r < 1)).toBe(true)
  })

  it('keeps tasks inside their goal week, and dates relative to now', () => {
    for (const goal of data.flatMap((o) => o.goals)) {
      for (const task of goal.tasks) {
        expect(task.date >= goal.weekStart && task.date <= goal.weekEnd).toBe(true)
      }
    }
    const later = buildDemoData(new Date(2027, 0, 13, 15))
    expect(later[0].goals.at(-1)!.weekStart.getFullYear()).toBe(2027)
  })

  it('marks the active goals recurring so next week materializes', () => {
    for (const objective of data.filter((o) => o.status === 'ACTIVE')) {
      expect(objective.goals.every((g) => g.recurring)).toBe(true)
    }
  })
})
