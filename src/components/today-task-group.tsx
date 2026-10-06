'use client'

import Link from 'next/link'
import { TaskItem } from '@/components/task-item'
import { TaskToggle } from '@/components/task-toggle'
import type { TaskGroup } from '@/lib/tasks'
import { isGoalFulfilled } from '@/lib/objectives'
import { cn } from '@/lib/utils'

export function TodayTaskGroup({
  group,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
}: {
  group: TaskGroup
  onToggleTask: (id: string) => Promise<void>
  /** With both edit handlers, each task gets the "⋯" menu to edit or delete it. */
  onUpdateTask?: (id: string, formData: FormData) => Promise<void>
  onDeleteTask?: (id: string) => Promise<void>
}) {
  const { weeklyGoal, tasks } = group
  const completed = tasks.filter((t) => t.completed).length

  // Only today's tasks — this is the day being done, not the week's goal being
  // fulfilled. `WeekGoalProgressCard` owns that larger claim.
  const dayComplete = isGoalFulfilled(tasks)

  return (
    <div
      data-complete={dayComplete}
      className={cn(
        'flex overflow-hidden rounded-lg border bg-card transition-[border-color,box-shadow] motion-reduce:transition-none',
        dayComplete ? 'border-primary/60 shadow-[0_0_18px_var(--glow)]' : 'border-border',
      )}
    >
      <div className="w-[3px] shrink-0 bg-primary" />
      <div className="flex-1">
        <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col text-left">
            <Link
              href={`/objectives/${weeklyGoal.objective.id}/weeks/${weeklyGoal.id}`}
              className="text-sm font-semibold break-words hover:text-accent-foreground hover:underline"
            >
              {weeklyGoal.title}
            </Link>
            <Link
              href={`/objectives/${weeklyGoal.objective.id}`}
              className="text-xs break-words text-muted-foreground hover:text-accent-foreground hover:underline"
            >
              {weeklyGoal.objective.title}
            </Link>
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums',
              dayComplete ? 'bg-primary text-primary-foreground shadow-[0_0_10px_var(--glow)]' : 'bg-accent text-accent-foreground',
            )}
          >
            {dayComplete ? '✓ feito' : `${completed}/${tasks.length}`}
          </span>
        </div>
        <div className="flex flex-col">
          {tasks.map((task) =>
            onUpdateTask && onDeleteTask ? (
              <TaskItem
                key={task.id}
                task={task}
                weekStart={weeklyGoal.weekStart}
                className="border-b border-border/60 px-4 py-2 last:border-b-0 hover:bg-accent"
                onToggle={onToggleTask}
                onUpdate={onUpdateTask}
                onDelete={onDeleteTask}
              />
            ) : (
              // A wrapping label makes the whole row the checkbox's hit target.
              <label
                key={task.id}
                className="flex cursor-pointer items-center gap-3 border-b border-border/60 px-4 py-2 last:border-b-0 hover:bg-accent"
              >
                <TaskToggle taskId={task.id} completed={task.completed} action={onToggleTask} />
                <span
                  className={`min-w-0 break-words text-sm ${task.completed ? 'line-through text-muted-foreground' : ''}`}
                >
                  {task.title}
                </span>
              </label>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
