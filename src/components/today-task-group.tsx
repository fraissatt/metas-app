'use client'

import Link from 'next/link'
import { TaskToggle } from '@/components/task-toggle'
import type { TaskGroup } from '@/lib/tasks'
import { isGoalFulfilled } from '@/lib/objectives'
import { cn } from '@/lib/utils'

export function TodayTaskGroup({
  group,
  onToggleTask,
}: {
  group: TaskGroup
  onToggleTask: (id: string) => Promise<void>
}) {
  const { weeklyGoal, tasks } = group
  const completed = tasks.filter((t) => t.completed).length

  // Only today's tasks — this is the day being done, not the week's goal being
  // fulfilled. `WeekGoalProgressCard` owns that larger claim.
  const dayComplete = isGoalFulfilled(tasks)

  return (
    <div className="flex overflow-hidden rounded-lg border border-border">
      <div className="w-[3px] shrink-0 bg-primary" />
      <div className="flex-1">
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col text-left">
            <Link
              href={`/objectives/${weeklyGoal.objective.id}/weeks/${weeklyGoal.id}`}
              className="text-sm font-semibold hover:text-primary hover:underline"
            >
              {weeklyGoal.title}
            </Link>
            <Link
              href={`/objectives/${weeklyGoal.objective.id}`}
              className="text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              {weeklyGoal.objective.title}
            </Link>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
              dayComplete ? 'bg-primary text-primary-foreground' : 'bg-accent text-primary',
            )}
          >
            {dayComplete ? '✓ feito' : `${completed}/${tasks.length}`}
          </span>
        </div>
        <div className="flex flex-col">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 border-b border-border/60 px-4 py-2 last:border-b-0 hover:bg-accent"
            >
              <TaskToggle taskId={task.id} completed={task.completed} action={onToggleTask} />
              <span
                className={`break-words text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}
              >
                {task.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
