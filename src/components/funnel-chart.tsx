'use client'

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import type { FunnelStage } from '@/lib/actions/funnel'

type ChartRow = {
  id: FunnelStage['id']
  label: string
  sessions: number
  percentOfStart: number
  drop: string
  isBiggestDrop: boolean
}

// Only a real drop is shown: null (first stage) and 0 are "—".
const formatDrop = (drop: number | null) => (drop === null || drop <= 0 ? '—' : `−${drop}%`)

const CHART_HEIGHT_PER_ROW = 40
const Y_AXIS_WIDTH = 80
const INITIAL_WIDTH = 320

type BarLabelProps = { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number }

function barLabelFor(rows: ChartRow[]) {
  return function BarLabel(props: object) {
    const { x = 0, y = 0, width = 0, height = 0, index = 0 } = props as BarLabelProps
    const row = rows[index]
    if (!row) return null
    return (
      <text x={Number(x) + Number(width) + 8} y={Number(y) + Number(height) / 2} dominantBaseline="central" fontSize={12}>
        <tspan fill="var(--foreground)">{`${row.sessions} · ${row.percentOfStart}%`}</tspan>
      </text>
    )
  }
}

type TickProps = { x?: number | string; y?: number | string; payload?: { value?: string } }

// The drop sits under the stage label so the bar end only needs room for
// "n · p%", which keeps the chart usable at 375px.
function stageTickFor(rows: ChartRow[]) {
  return function StageTick(props: object) {
    const { x = 0, y = 0, payload } = props as TickProps
    const row = rows.find((r) => r.label === payload?.value)
    if (!row) return null
    const showDrop = row.drop !== '—'
    return (
      <text x={Number(x)} y={Number(y)} textAnchor="end" fontSize={13}>
        <tspan x={Number(x)} dy={showDrop ? '-0.2em' : '0.35em'} fill="var(--foreground)">
          {row.label}
        </tspan>
        {showDrop && (
          <tspan
            x={Number(x)}
            dy="1.3em"
            fontSize={11}
            fill={row.isBiggestDrop ? 'var(--destructive)' : 'var(--muted-foreground)'}
          >
            {row.drop}
          </tspan>
        )}
      </text>
    )
  }
}

export function FunnelChart({ stages, biggestDropId }: { stages: FunnelStage[]; biggestDropId: FunnelStage['id'] | null }) {
  const rows: ChartRow[] = stages.map((s) => ({
    id: s.id,
    label: s.label,
    sessions: s.sessions,
    percentOfStart: s.percentOfStart,
    drop: formatDrop(s.dropFromPrevious),
    isBiggestDrop: s.id === biggestDropId,
  }))
  const biggest = stages.find((s) => s.id === biggestDropId)
  const chartHeight = rows.length * CHART_HEIGHT_PER_ROW + 16
  const hasData = stages.some((s) => s.sessions > 0)

  return (
    <div>
      <div aria-hidden="true">
        <ResponsiveContainer
          width="100%"
          height={chartHeight}
          initialDimension={{ width: INITIAL_WIDTH, height: chartHeight }}
        >
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 72, left: 0, bottom: 4 }}>
            <XAxis type="number" hide domain={[0, Math.max(1, ...rows.map((r) => r.sessions))]} />
            <YAxis
              type="category"
              dataKey="label"
              width={Y_AXIS_WIDTH}
              axisLine={false}
              tickLine={false}
              tick={stageTickFor(rows)}
            />
            <Bar dataKey="sessions" radius={[0, 4, 4, 0]} isAnimationActive={false} barSize={22}>
              {rows.map((r) => (
                <Cell key={r.id} fill={r.id === 'plan' ? 'var(--support)' : 'var(--primary)'} />
              ))}
              <LabelList content={barLabelFor(rows)} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {hasData && biggest && biggest.dropFromPrevious !== null && biggest.dropFromPrevious > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          Maior abandono: {biggest.label} ({formatDrop(biggest.dropFromPrevious)})
        </p>
      )}

      <table className="sr-only">
        <caption>Funil do quiz por etapa</caption>
        <thead>
          <tr>
            <th scope="col">Etapa</th>
            <th scope="col">Sessões</th>
            <th scope="col">% do início</th>
            <th scope="col">Queda</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-biggest-drop={r.isBiggestDrop ? 'true' : undefined}>
              <th scope="row">{r.label}</th>
              <td>{r.sessions}</td>
              <td>{`${r.percentOfStart}%`}</td>
              <td>{r.drop}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
