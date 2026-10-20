import { appToday, appWeekdayIndex, formatDayKey, parseDay } from '@/lib/dates'

/** Share of a day's planned tasks that makes it a done day. */
export const DONE_THRESHOLD = 0.6

export type DayTone = 'empty' | 'partial' | 'done'

/** Plain data (no Dates), so it crosses into client components as is. */
export type DayDot = { key: string; tone: DayTone; isCurrentDay: boolean }

export type TaskDay = { date: Date; completed: boolean }

export type DayDotsYear = {
  year: number
  dots: DayDot[]
  daysDone: number
  firstYear: number
  currentYear: number
}

export function dayTone(completed: number, total: number): DayTone {
  if (total === 0 || completed === 0) return 'empty'
  return completed / total >= DONE_THRESHOLD ? 'done' : 'partial'
}

// A task belongs to the Brasília day it was planned for (`date`), never to
// when it was ticked: a task done late still lights its own day.
function tallyByDay(tasks: TaskDay[]): Map<string, { completed: number; total: number }> {
  const byDay = new Map<string, { completed: number; total: number }>()
  for (const task of tasks) {
    const key = formatDayKey(task.date)
    const tally = byDay.get(key) ?? { completed: 0, total: 0 }
    tally.total += 1
    if (task.completed) tally.completed += 1
    byDay.set(key, tally)
  }
  return byDay
}

export function buildDayDots(tasks: TaskDay[], days: Date[], now: Date): DayDot[] {
  const byDay = tallyByDay(tasks)
  const today = appToday(now)
  const todayKey = formatDayKey(today)

  return days.map((day) => {
    const key = formatDayKey(day)
    const tally = byDay.get(key)
    const tone = day > today || !tally ? 'empty' : dayTone(tally.completed, tally.total)
    return { key, tone, isCurrentDay: key === todayKey }
  })
}

export function countDaysDone(tasks: TaskDay[]): number {
  let done = 0
  for (const { completed, total } of tallyByDay(tasks).values()) {
    if (dayTone(completed, total) === 'done') done += 1
  }
  return done
}

export const compoundFactor = (daysDone: number) => 1.01 ** daysDone

const shortFactor = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const wholeFactor = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

/** `5,6×` under 100, `1.427×` from 100 up. */
export function formatFactor(factor: number): string {
  return `${(factor < 100 ? shortFactor : wholeFactor).format(factor)}×`
}

/** Columns of seven (Monday → Sunday); cells outside the year are null. */
export function layoutYearWeeks(dots: DayDot[]): (DayDot | null)[][] {
  if (dots.length === 0) return []
  const cells: (DayDot | null)[] = [...Array(appWeekdayIndex(parseDay(dots[0].key))).fill(null), ...dots]
  while (cells.length % 7 !== 0) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
}
