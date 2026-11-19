import { buildPaceSeries, type PaceInput } from '@/lib/pace'
import { addAppDays, differenceInAppDays, formatDayKey, startOfAppDay } from '@/lib/dates'

export type OverallPaceObjective = { id: string; title: string } & Omit<PaceInput, 'today'>

/** One objective's place against its ideal today. `donePercent`/`idealPercent` are 0–100. */
export type OverallPaceRow = {
  id: string
  title: string
  donePercent: number
  idealPercent: number
  /** At or above the ideal (a gap under one point counts as level). */
  onTrack: boolean
  /** Whole points below the ideal; 0 when on track. */
  gapPoints: number
}

export type OverallPaceDay = { key: string; day: Date; values: Record<string, number | null> }

export type OverallPace = {
  rows: OverallPaceRow[]
  /** One entry per day from the earliest start to today; `values` is keyed by objective id. */
  days: OverallPaceDay[]
}

/**
 * The whole picture of the objectives in progress: each one's accumulated
 * progress over the calendar, and where each stands against its ideal today.
 *
 * It reuses `buildPaceSeries`, so "done" and "ideal for today" mean here exactly
 * what they mean on the objective's own page. Objectives with no planned task
 * have no pace yet and are left out; the line only ever rises or stays flat.
 */
export function buildOverallPace(objectives: OverallPaceObjective[], today: Date): OverallPace | null {
  const built = objectives.flatMap((objective) => {
    const result = buildPaceSeries({ ...objective, today })
    return result ? [{ objective, ...result }] : []
  })
  if (built.length === 0) return null

  const rows: OverallPaceRow[] = built.map(({ objective, summary }) => ({
    id: objective.id,
    title: objective.title,
    donePercent: summary.donePercent,
    idealPercent: summary.idealPercent,
    onTrack: summary.gapPoints < 1,
    gapPoints: Math.round(summary.gapPoints),
  }))

  const todayStart = startOfAppDay(today)
  const first = built.reduce((min, { points }) => (points[0].day < min ? points[0].day : min), built[0].points[0].day)
  const length = Math.max(1, differenceInAppDays(todayStart, first) + 1)

  const byObjective = new Map(
    built.map(({ objective, points }) => [
      objective.id,
      new Map(points.map((point) => [formatDayKey(point.day), point.real])),
    ]),
  )

  const days: OverallPaceDay[] = Array.from({ length }, (_, index) => {
    const day = addAppDays(first, index)
    const key = formatDayKey(day)
    const values: Record<string, number | null> = {}
    for (const { objective } of built) values[objective.id] = byObjective.get(objective.id)?.get(key) ?? null
    return { key, day, values }
  })

  return { rows, days }
}

/** The sentence over the chart: how many are level or ahead, in a gentle tone. */
export function describeOverallPace(rows: OverallPaceRow[]): string {
  const onTrack = rows.filter((row) => row.onTrack).length
  if (rows.length === 1) return onTrack === 1 ? 'Seu objetivo está no ritmo ou à frente.' : `Faltam ${rows[0].gapPoints} pontos para o ritmo ideal.`
  if (onTrack === rows.length) return `Os ${rows.length} objetivos estão no ritmo ou à frente.`
  if (onTrack === 0) return 'Hoje todos estão um pouco abaixo do ritmo ideal. Uma tarefa a mais por objetivo já ajuda.'
  return `${onTrack} de ${rows.length} objetivos estão no ritmo ou à frente.`
}
