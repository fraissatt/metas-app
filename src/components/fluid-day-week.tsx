'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { TaskToggle } from '@/components/task-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { listDailyTasksByDate } from '@/lib/actions/dailyTasks'
import type { listWeeklyGoalsForCurrentWeek } from '@/lib/actions/weeklyGoals'

type DailyTasks = Awaited<ReturnType<typeof listDailyTasksByDate>>
type WeeklyGoals = Awaited<ReturnType<typeof listWeeklyGoalsForCurrentWeek>>

export function FluidDayWeek({
  tasks,
  goals,
  progress,
  onToggleTask,
}: {
  tasks: DailyTasks
  goals: WeeklyGoals
  progress: Array<{ total: number; completed: number; percent: number }>
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
            {tasks.map((task) => (
              <Card key={task.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    <Link href={`/objectives/${task.weeklyGoal.objective.id}`}>
                      {task.weeklyGoal.objective.title}
                    </Link>
                    {' · '}
                    {task.weeklyGoal.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-start gap-3">
                  <TaskToggle taskId={task.id} completed={task.completed} action={onToggleTask} />
                  <span
                    className={`break-words ${task.completed ? 'line-through text-muted-foreground' : ''}`}
                  >
                    {task.title}
                  </span>
                </CardContent>
              </Card>
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
              {goals.map((goal, i) => (
                <Card key={goal.id}>
                  <CardHeader>
                    <CardTitle>
                      <Link href={`/objectives/${goal.objective.id}/weeks/${goal.id}`}>{goal.title}</Link>
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {goal.objective.title}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <Progress value={progress[i].percent} />
                    <span className="text-sm text-muted-foreground">
                      {progress[i].completed}/{progress[i].total} tarefas ({progress[i].percent}%)
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
