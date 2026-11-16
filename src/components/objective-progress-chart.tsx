'use client'

import { BarChart3 } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function ObjectiveProgressChart({ data }: { data: Array<{ weekLabel: string; percent: number }> }) {
  if (data.length === 0) {
    return (
      <EmptyState icon={BarChart3} title="Ainda sem semanas para mostrar" compact>
        Cada meta semanal vira uma barra aqui, com a parte das tarefas que você concluiu.
      </EmptyState>
    )
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
