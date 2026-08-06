'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function ObjectiveProgressChart({ data }: { data: Array<{ weekLabel: string; percent: number }> }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem metas semanais ainda para gerar o gráfico.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="weekLabel" stroke="var(--muted-foreground)" tick={{ fill: 'var(--muted-foreground)' }} />
        <YAxis
          domain={[0, 100]}
          unit="%"
          stroke="var(--muted-foreground)"
          tick={{ fill: 'var(--muted-foreground)' }}
        />
        <Tooltip
          cursor={false}
          formatter={(value) => [`${value}%`, 'Concluído']}
          contentStyle={{
            background: 'var(--popover)',
            borderColor: 'var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--popover-foreground)',
          }}
        />
        <Bar dataKey="percent" fill="var(--primary)" radius={[4, 4, 0, 0]} activeBar={{ fill: 'var(--primary)' }} />
      </BarChart>
    </ResponsiveContainer>
  )
}
