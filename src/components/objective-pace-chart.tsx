'use client'

import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ObjectivePaceInput } from '@/lib/actions/progress'
import { appToday, differenceInAppDays, formatDayMonth } from '@/lib/dates'
import { IDEAL_GOAL, buildPaceSeries, type PacePoint, type PaceSummary } from '@/lib/pace'
import { cn } from '@/lib/utils'

const PERIOD_OPTIONS = [30, 60] as const
const ALL = 'all'
type Period = typeof ALL | (typeof PERIOD_OPTIONS)[number]

const idealPercent = Math.round(IDEAL_GOAL * 100)
const points = (value: number) => `${value} ${value === 1 ? 'ponto' : 'pontos'}`

/**
 * The sentence above the chart. Behind is told as a distance to the ideal and,
 * when it helps, a concrete step; never as a loss — no minus sign, no "caiu".
 */
function describePace(summary: PaceSummary, completed: boolean): string {
  const done = Math.round(summary.donePercent)
  if (completed) return `Objetivo concluído: ${done}% do plano feito.`

  const gap = Math.round(summary.gapPoints)
  if (gap < 1) return 'Você está no ritmo ou à frente.'

  const nudge = summary.tasksPerWeekToCatchUp
  return nudge
    ? `Faltam ${points(gap)} para o ritmo ideal. Com ${nudge} ${nudge === 1 ? 'tarefa' : 'tarefas'} a mais por semana você chega aos ${idealPercent}%.`
    : `Faltam ${points(gap)} para o ritmo ideal.`
}

/** `size` days that contain today, ending a third of the way past it where the range allows. */
function windowOf(all: PacePoint[], todayIndex: number, size: number): PacePoint[] {
  if (size >= all.length) return all
  const end = Math.min(all.length - 1, todayIndex + Math.ceil(size / 3))
  const start = Math.max(0, end - size + 1)
  return all.slice(start, start + size)
}

export function ObjectivePaceChart({ input }: { input: ObjectivePaceInput }) {
  const [period, setPeriod] = useState<Period>(ALL)

  const result = useMemo(
    () =>
      buildPaceSeries({
        tasks: input.tasks.map((task) => ({
          date: new Date(task.date),
          completed: task.completed,
          completedAt: task.completedAt ? new Date(task.completedAt) : null,
        })),
        startDate: new Date(input.startDate),
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        completedAt: input.completedAt ? new Date(input.completedAt) : null,
        today: appToday(),
      }),
    [input],
  )

  if (!result) {
    return <p className="text-sm text-muted-foreground">Sem tarefas planejadas ainda para gerar o gráfico.</p>
  }

  const { points: all, summary } = result
  const completed = input.completedAt !== null
  const todayIndex = Math.min(Math.max(differenceInAppDays(appToday(), all[0].day), 0), all.length - 1)
  const shown = windowOf(all, todayIndex, period === ALL ? all.length : period)
  const periods = PERIOD_OPTIONS.filter((days) => days < all.length)
  const todayLabel = formatDayMonth(all[todayIndex].day)

  const data = shown.map((point) => ({
    label: formatDayMonth(point.day),
    ideal: Math.round(point.ideal * 10) / 10,
    real: point.real === null ? null : Math.round(point.real * 10) / 10,
    projection: point.projection === null ? null : Math.round(point.projection * 10) / 10,
  }))
  const tableRows = all.filter((_, index) => index % 7 === 0 || index === all.length - 1)
  const showToday = shown.some((point) => formatDayMonth(point.day) === todayLabel)

  return (
    <section aria-label="Ritmo do objetivo" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-semibold">Ritmo</h2>
        <div role="group" aria-label="Período" className="flex gap-1">
          {([...periods, ALL] as Period[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={period === option}
              onClick={() => setPeriod(option)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs transition-colors',
                period === option
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {option === ALL ? 'Prazo todo' : `${option} dias`}
            </button>
          ))}
        </div>
      </div>

      <p data-testid="pace-summary" className="text-sm">
        {describePace(summary, completed)}
        <span className="block text-muted-foreground tabular-nums">
          Feito {Math.round(summary.donePercent)}% · ideal para hoje {Math.round(summary.idealPercent)}%
          {summary.projectedPercent !== null && ` · projeção no fim ${Math.round(summary.projectedPercent)}%`}
        </span>
      </p>

      <div role="img" aria-label={describePace(summary, completed)}>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="label"
              stroke="var(--muted-foreground)"
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              minTickGap={24}
            />
            <YAxis
              domain={[0, 100]}
              unit="%"
              stroke="var(--muted-foreground)"
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            />
            <Tooltip
              formatter={(value, name) => [
                `${Math.round(Number(value))}%`,
                name === 'ideal' ? 'Ideal' : name === 'real' ? 'Feito' : 'Projeção',
              ]}
              contentStyle={{
                background: 'var(--popover)',
                borderColor: 'var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--popover-foreground)',
              }}
            />
            {showToday && (
              <ReferenceLine
                x={todayLabel}
                stroke="var(--border)"
                label={{ value: 'hoje', fill: 'var(--muted-foreground)', fontSize: 11, position: 'insideTopRight' }}
              />
            )}
            <Line
              dataKey="ideal"
              stroke="var(--muted-foreground)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
            {!completed && (
              <Line
                dataKey="projection"
                stroke="var(--primary)"
                strokeWidth={2}
                strokeDasharray="2 5"
                strokeLinecap="round"
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            )}
            <Line
              dataKey="real"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul data-testid="pace-legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block w-5 border-t-2 border-primary" />
          Seu progresso
        </li>
        {!completed && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block w-5 border-t-2 border-dotted border-primary" />
            Projeção no ritmo atual
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block w-5 border-t-2 border-dashed border-muted-foreground" />
          Ideal ({idealPercent}% do plano)
        </li>
      </ul>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Ver em tabela</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead>
            <tr className="text-left">
              <th className="font-medium">Dia</th>
              <th className="font-medium">Feito</th>
              <th className="font-medium">Ideal</th>
              {!completed && <th className="font-medium">Projeção</th>}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((point) => (
              <tr key={point.day.toISOString()}>
                <td>{formatDayMonth(point.day)}</td>
                <td>{point.real === null ? '—' : `${Math.round(point.real)}%`}</td>
                <td>{Math.round(point.ideal)}%</td>
                {!completed && <td>{point.projection === null ? '—' : `${Math.round(point.projection)}%`}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
