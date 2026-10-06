import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  endOfDay,
  endOfWeek,
  format,
  getDate,
  isSameDay,
  isValid,
  parseISO,
  setHours,
  startOfDay,
  startOfWeek,
} from 'date-fns'
import { tz } from '@date-fns/tz'

// Every calendar day in the app is a day in Brasília, wherever the code runs:
// Vercel's servers are on UTC, browsers on whatever the visitor uses. This
// module is the only place allowed to do day/week math (see
// dates-guard.test.ts); a stored calendar day is the instant of 00:00 in
// Brasília.
export const APP_TIME_ZONE = 'America/Sao_Paulo'
const inApp = { in: tz(APP_TIME_ZONE) }
const week = { ...inApp, weekStartsOn: 1 as const }

// date-fns returns TZDate here; Prisma, React and Intl want plain Dates.
const plain = (date: Date) => new Date(date.getTime())

export function appToday(now: Date = new Date()): Date {
  return plain(startOfDay(now, inApp))
}

/** `yyyy-MM-dd` → 00:00 of that day in Brasília. */
export function parseDay(key: string): Date {
  const date = parseISO(key, inApp)
  if (!isValid(date)) throw new RangeError(`Invalid day: ${key}`)
  return plain(startOfDay(date, inApp))
}

/** The Brasília day of `date` as `yyyy-MM-dd`, the wire format of forms. */
export function formatDayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd', inApp)
}

export const startOfAppDay = (date: Date) => plain(startOfDay(date, inApp))
export const endOfAppDay = (date: Date) => plain(endOfDay(date, inApp))
export const isSameAppDay = (a: Date, b: Date) => isSameDay(a, b, inApp)
export const addAppDays = (date: Date, n: number) => plain(addDays(date, n, inApp))
export const addAppMonths = (date: Date, n: number) => plain(addMonths(date, n, inApp))
export const addAppWeeks = (date: Date, n: number) => plain(addWeeks(date, n, inApp))
export const appDayOfMonth = (date: Date) => getDate(date, inApp)
export const differenceInAppDays = (a: Date, b: Date) => differenceInCalendarDays(a, b, inApp)
export const differenceInAppWeeks = (a: Date, b: Date) => differenceInCalendarWeeks(a, b, week)
export const atAppHour = (date: Date, hour: number) => plain(setHours(startOfDay(date, inApp), hour, inApp))

export function getWeekBounds(date: Date): { weekStart: Date; weekEnd: Date } {
  return { weekStart: plain(startOfWeek(date, week)), weekEnd: plain(endOfWeek(date, week)) }
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addAppDays(weekStart, i))
}

// Display formatting goes through Intl rather than hand-written patterns so
// the locale owns separators and ordering.
const fullDate = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const dayMonth = new Intl.DateTimeFormat('pt-BR', { timeZone: APP_TIME_ZONE, day: '2-digit', month: '2-digit' })

export function formatDate(date: Date): string {
  return fullDate.format(date)
}

export function formatDayMonth(date: Date): string {
  return dayMonth.format(date)
}
