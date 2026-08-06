import type { DailyTask, Objective, WeeklyGoal } from '@prisma/client'

export type TaskWithGoal = DailyTask & { weeklyGoal: WeeklyGoal & { objective: Objective } }

export type TaskGroup = {
  weeklyGoal: WeeklyGoal & { objective: Objective }
  tasks: TaskWithGoal[]
}

export function groupTasksByWeeklyGoal(tasks: TaskWithGoal[]): TaskGroup[] {
  const order: string[] = []
  const byGoal = new Map<string, TaskGroup>()

  for (const task of tasks) {
    const goalId = task.weeklyGoal.id
    if (!byGoal.has(goalId)) {
      order.push(goalId)
      byGoal.set(goalId, { weeklyGoal: task.weeklyGoal, tasks: [] })
    }
    byGoal.get(goalId)!.tasks.push(task)
  }

  return order.map((goalId) => byGoal.get(goalId)!)
}
