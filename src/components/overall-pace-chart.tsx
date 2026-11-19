'use client'

import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { OverallPaceInput } from '@/lib/actions/progress'
import { appToday, formatDayMonth } from '@/lib/dates'
import { buildOverallPace, describeOverallPace } from '@/lib/pace-overall'
import { cn } from '@/lib/utils'

// One colour per objective, from the app's categorical tokens (both themes define them).
const COLORS = ['--lp-green', '--lp-blue', '--lp-amber', '--lp-violet', '--lp-pink', '--lp-cyan'].map(
  (token) => `var(${token})`,
)
const PERIODS = [30, 90] as const
const ALL = 'all'
type Period = typeof ALL | (typeof PERIODS)[number]

/**
 * Every objective in progress on one calendar: where each one stands against
 * its ideal today, and the line of how it got there. Calm wording: being below
 * the ideal is a distance, never a loss.
 */
export function OverallPaceChart({ input }: { input: OverallPaceInput }) {
  const [period, setPeriod] = useState<Period>(ALL)

  const result = useMemo(
    () =>
      buildOverallPace(
        input.map((objective) => ({
          id: objective.id,
          title: objective.title,
          tasks: objective.tasks.map((task) => ({
            date: new Date(task.date),
            completed: task.completed,
            completedAt: task.completedAt ? new Date(task.completedAt) : null,
          })),
          startDate: new Date(objective.startDate),
          targetDate: objective.targetDate ? new Date(objective.targetDate) : null,
          completedAt: null,
        })),
        appToday(),
      ),
    [input],
  )

  if (!result) return null

  const { rows, days } = result
  const shown = period === ALL ? days : days.slice(-period)
  const periods = PERIODS.filter((size) => size < days.length)
  const color = (index: number) => COLORS[index % COLORS.length]
  const data = shown.map((day) => ({
    label: formatDayMonth(day.day),
    ...Object.fromEntries(rows.map((row, index) => [`o${index}`, day.values[row.id] === null ? null : Math.round((day.values[row.id] ?? 0) * 10) / 10])),
  }))
  const sentence = describeOverallPace(rows)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Ritmo geral</h2>
        {periods.length > 0 && (
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
                {option === ALL ? 'Tudo' : `${option} dias`}
              </button>
            ))}
          </div>
        )}
      </div>

      <p data-testid="overall-pace-summary" className="text-sm">
        {sentence}
      </p>

      <div role="img" aria-label={sentence}>
        <ResponsiveContainer width="100%" height={200}>
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
              formatter={(value, name) => [`${Math.round(Number(value))}%`, rows[Number(String(name).slice(1))]?.title ?? '']}
              contentStyle={{
                background: 'var(--popover)',
                borderColor: 'var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--popover-foreground)',
              }}
            />
            {rows.map((row, index) => (
              <Line
                key={row.id}
                dataKey={`o${index}`}
                stroke={color(index)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul data-testid="overall-pace-rows" className="flex flex-col gap-1.5 text-sm">
        {rows.map((row, index) => (
          <li key={row.id} className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-0.5 w-4 shrink-0 rounded" style={{ background: color(index) }} />
            <span className="min-w-0 flex-1 truncate">{row.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              Feito {Math.round(row.donePercent)}% · ideal {Math.round(row.idealPercent)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
