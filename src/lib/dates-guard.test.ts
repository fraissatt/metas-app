import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Day/week math outside src/lib/dates.ts silently uses the machine's time
// zone — UTC on Vercel, Brasília locally — and shifts days. Keep it in one place.
const FORBIDDEN =
  /\b(startOfDay|endOfDay|startOfWeek|endOfWeek|isSameDay|parseISO|differenceInCalendarDays|differenceInCalendarWeeks|setHours|isToday)\b|\.(getDay|getDate|getMonth|getFullYear)\(\)|format\([^)]*'yyyy-MM-dd'\)/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('date math stays in src/lib/dates.ts', () => {
  it('no other source file uses day/week date-fns functions directly', () => {
    const offenders = sourceFiles(join(process.cwd(), 'src'))
      .filter((file) => !file.endsWith(join('lib', 'dates.ts')))
      .filter((file) => FORBIDDEN.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
