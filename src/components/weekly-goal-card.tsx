'use client'

import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WeeklyGoalDayChart } from '@/components/weekly-goal-day-chart'
import { WeeklyGoalTasks } from '@/components/weekly-goal-tasks'
import type { WeeklyGoalWithTasks } from '@/lib/actions/weeklyGoals'

export function WeeklyGoalCard({
  goal,
  expanded,
  onToggleExpand,
  onCreateTasks,
  onDelete,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
}: {
  goal: WeeklyGoalWithTasks
  expanded: boolean
  onToggleExpand: () => void
  onCreateTasks: (formData: FormData) => Promise<void>
  onDelete: () => Promise<void>
  onToggleTask: (taskId: string) => Promise<void>
  onUpdateTask: (taskId: string, formData: FormData) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>
          <Link href={`/objectives/${goal.objectiveId}/weeks/${goal.id}`}>{goal.title}</Link>
        </CardTitle>
        {goal.recurring && (
          <span className="w-fit rounded-full bg-support-muted px-2 py-0.5 text-[11px] font-medium text-support-foreground">
            repete toda semana
          </span>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <WeeklyGoalTasks
          goal={goal}
          onCreateTasks={onCreateTasks}
          onDelete={onDelete}
          onToggleTask={onToggleTask}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
        />

        <Button type="button" variant="ghost" size="sm" onClick={onToggleExpand} aria-expanded={expanded}>
          {expanded ? 'Ver menos' : 'Ver detalhes'}
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>

        {expanded && (
          <div className="border-t border-border pt-3">
            <WeeklyGoalDayChart weekStart={goal.weekStart} tasks={goal.dailyTasks} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
