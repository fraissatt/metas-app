import { startOfWeek, endOfWeek } from 'date-fns'

export function getWeekBounds(date: Date): { weekStart: Date; weekEnd: Date } {
  return {
    weekStart: startOfWeek(date, { weekStartsOn: 1 }),
    weekEnd: endOfWeek(date, { weekStartsOn: 1 }),
  }
}
