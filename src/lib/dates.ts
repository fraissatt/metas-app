import { addDays, endOfWeek, startOfWeek } from 'date-fns'

export function getWeekBounds(date: Date): { weekStart: Date; weekEnd: Date } {
  return {
    weekStart: startOfWeek(date, { weekStartsOn: 1 }),
    weekEnd: endOfWeek(date, { weekStartsOn: 1 }),
  }
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}
