'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { TodayTaskGroup } from '@/components/today-task-group'
import { WeekGoalProgressCard } from '@/components/week-goal-progress-card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { groupTasksByWeeklyGoal } from '@/lib/tasks'
import type { listDailyTasksByDate } from '@/lib/actions/dailyTasks'
import type { listWeeklyGoalsForCurrentWeek } from '@/lib/actions/weeklyGoals'

type DailyTasks = Awaited<ReturnType<typeof listDailyTasksByDate>>
type WeeklyGoals = Awaited<ReturnType<typeof listWeeklyGoalsForCurrentWeek>>

export function FluidDayWeek({
  tasks,
  goals,
  onToggleTask,
}: {
  tasks: DailyTasks
  goals: WeeklyGoals
  onToggleTask: (id: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Hoje</h1>
        {tasks.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma tarefa para hoje.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {groupTasksByWeeklyGoal(tasks).map((group) => (
              <TodayTaskGroup key={group.weeklyGoal.id} group={group} onToggleTask={onToggleTask} />
            ))}
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="week-section"
        className="w-full border-dashed border-primary text-primary hover:bg-primary/10 hover:text-primary"
      >
        {expanded ? 'Recolher semana' : 'Ver semana'}
        {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </Button>

      <div
        id="week-section"
        aria-hidden={!expanded}
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden" inert={!expanded}>
          <h2 className="mb-6 text-2xl font-semibold">Esta semana</h2>
          {goals.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma meta semanal para esta semana.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {goals.map((goal) => (
                <WeekGoalProgressCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
