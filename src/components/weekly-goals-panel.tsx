'use client'

import { useState } from 'react'
import { AddWeeklyGoalCard } from '@/components/add-weekly-goal-card'
import { WeeklyGoalCard } from '@/components/weekly-goal-card'
import type { WeeklyGoalWithTasks } from '@/lib/actions/weeklyGoals'

export function WeeklyGoalsPanel({
  goals,
  onCreateTasks,
  onCreateWeeklyGoal,
  onDeleteWeeklyGoal,
  openNewGoal,
}: {
  goals: WeeklyGoalWithTasks[]
  onCreateTasks: (weeklyGoalId: string, formData: FormData) => Promise<void>
  onCreateWeeklyGoal: (formData: FormData) => Promise<void>
  onDeleteWeeklyGoal: (weeklyGoalId: string) => Promise<void>
  openNewGoal?: boolean
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      {goals.map((goal) => (
        <WeeklyGoalCard
          key={goal.id}
          goal={goal}
          expanded={expandedId === goal.id}
          onToggleExpand={() => setExpandedId((current) => (current === goal.id ? null : goal.id))}
          onCreateTasks={(formData) => onCreateTasks(goal.id, formData)}
          onDelete={() => onDeleteWeeklyGoal(goal.id)}
        />
      ))}
      <div id="nova-meta" className="scroll-mt-20">
        <AddWeeklyGoalCard onCreate={onCreateWeeklyGoal} defaultOpen={openNewGoal} />
      </div>
    </div>
  )
}
