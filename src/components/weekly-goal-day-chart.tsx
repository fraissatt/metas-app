'use client'

import { isSameDay } from 'date-fns'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DailyTask } from '@prisma/client'
import { getWeekDays } from '@/lib/dates'

const DAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']

export function WeeklyGoalDayChart({ weekStart, tasks }: { weekStart: Date; tasks: DailyTask[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem tarefas nesta semana ainda.</p>
  }

  const data = getWeekDays(weekStart).map((day, index) => {
    const dayTasks = tasks.filter((t) => isSameDay(t.date, day))
    return {
      label: DAY_LABELS[index],
      completed: dayTasks.filter((t) => t.completed).length,
      remaining: dayTasks.filter((t) => !t.completed).length,
    }
  })

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="label"
          stroke="var(--muted-foreground)"
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
        />
        <YAxis
          allowDecimals={false}
          stroke="var(--muted-foreground)"
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
        />
        <Tooltip
          cursor={false}
          contentStyle={{
            background: 'var(--popover)',
            borderColor: 'var(--border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--popover-foreground)',
          }}
        />
        <Bar dataKey="completed" stackId="day" fill="var(--primary)" activeBar={{ fill: 'var(--primary)' }} />
        <Bar
          dataKey="remaining"
          stackId="day"
          fill="var(--chart-1)"
          radius={[2, 2, 0, 0]}
          activeBar={{ fill: 'var(--primary)' }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
