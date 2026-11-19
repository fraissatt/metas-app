import { describe, expect, it } from 'vitest'
import { parseDay } from '@/lib/dates'
import { buildOverallPace, describeOverallPace, type OverallPaceObjective } from './pace-overall'

const today = parseDay('2026-11-10')

function objective(id: string, start: string, target: string, tasks: Array<[string, boolean]>): OverallPaceObjective {
  return {
    id,
    title: `Objetivo ${id}`,
    startDate: parseDay(start),
    targetDate: parseDay(target),
    completedAt: null,
    tasks: tasks.map(([date, completed]) => ({
      date: parseDay(date),
      completed,
      completedAt: completed ? parseDay(date) : null,
    })),
  }
}

describe('buildOverallPace', () => {
  it('is null when no objective has planned tasks yet', () => {
    expect(buildOverallPace([], today)).toBeNull()
    expect(buildOverallPace([objective('a', '2026-11-01', '2026-12-01', [])], today)).toBeNull()
  })

  it('gives each objective a row with done and ideal for today, like its own page', () => {
    const result = buildOverallPace(
      [objective('a', '2026-11-01', '2026-11-30', [['2026-11-02', true], ['2026-11-04', true], ['2026-11-20', false]])],
      today,
    )
    expect(result?.rows).toHaveLength(1)
    const [row] = result!.rows
    expect(row.id).toBe('a')
    expect(Math.round(row.donePercent)).toBe(67)
    expect(row.idealPercent).toBeGreaterThan(0)
    expect(row.onTrack).toBe(true)
    expect(row.gapPoints).toBe(0)
  })

  it('marks an objective below its ideal as behind, with the gap in whole points', () => {
    const result = buildOverallPace(
      [objective('b', '2026-11-01', '2026-11-30', [['2026-11-02', false], ['2026-11-04', false], ['2026-11-06', false], ['2026-11-20', false]])],
      today,
    )
    const [row] = result!.rows
    expect(row.onTrack).toBe(false)
    expect(row.gapPoints).toBeGreaterThan(0)
  })

  it('lays all objectives on one calendar, from the earliest start to today, with null before a start', () => {
    const result = buildOverallPace(
      [
        objective('a', '2026-11-01', '2026-11-30', [['2026-11-02', true], ['2026-11-25', false]]),
        objective('b', '2026-11-05', '2026-12-05', [['2026-11-06', true], ['2026-12-01', false]]),
      ],
      today,
    )
    const days = result!.days
    expect(days[0].key).toBe('2026-11-01')
    expect(days.at(-1)?.key).toBe('2026-11-10')
    expect(days).toHaveLength(10)
    expect(days[0].values.b).toBeNull() // b has not started
    expect(days[5].values.b).not.toBeNull() // 2026-11-06
  })

  it('never lets an objective line fall', () => {
    const result = buildOverallPace(
      [objective('a', '2026-11-01', '2026-11-30', [['2026-11-02', true], ['2026-11-03', true], ['2026-11-20', false]])],
      today,
    )
    const line = result!.days.map((day) => day.values.a).filter((v): v is number => v !== null)
    expect(line).toEqual([...line].sort((x, y) => x - y))
  })
})

describe('describeOverallPace', () => {
  const row = (id: string, onTrack: boolean) => ({
    id,
    title: id,
    donePercent: 0,
    idealPercent: 0,
    onTrack,
    gapPoints: onTrack ? 0 : 6,
  })

  it('speaks gently in every case, never in losses', () => {
    expect(describeOverallPace([row('a', true), row('b', true)])).toBe('Os 2 objetivos estão no ritmo ou à frente.')
    expect(describeOverallPace([row('a', true), row('b', false)])).toBe('1 de 2 objetivos estão no ritmo ou à frente.')
    expect(describeOverallPace([row('a', false), row('b', false)])).toMatch(/um pouco abaixo/)
    expect(describeOverallPace([row('a', true)])).toBe('Seu objetivo está no ritmo ou à frente.')
    expect(describeOverallPace([row('a', false)])).toBe('Faltam 6 pontos para o ritmo ideal.')
  })
})
