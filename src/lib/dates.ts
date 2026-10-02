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

// Display formatting goes through Intl rather than hand-written patterns so
// the locale owns separators and ordering. Form values keep using
// `format(date, 'yyyy-MM-dd')`, which is a wire format, not a display one.
const fullDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })

export function formatDate(date: Date): string {
  return fullDate.format(date)
}

export function formatDayMonth(date: Date): string {
  return dayMonth.format(date)
}
