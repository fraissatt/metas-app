'use client'

import { useEffect, useRef, useState } from 'react'
import { TodayTaskGroup } from '@/components/today-task-group'
import { WeekGoalProgressCard } from '@/components/week-goal-progress-card'
import { Button } from '@/components/ui/button'
import { differenceInAppDays, formatDate, isSameAppDay } from '@/lib/dates'
import type { DemoGoal, LandingDemoData } from '@/lib/landing-demo'
import { groupTasksByWeeklyGoal } from '@/lib/tasks'

export type DemoStep = 0 | 1 | 2

function toggleTask(goals: DemoGoal[], taskId: string): DemoGoal[] {
  return goals.map((goal) => ({
    ...goal,
    dailyTasks: goal.dailyTasks.map((task) =>
      task.id === taskId
        ? { ...task, completed: !task.completed, completedAt: task.completed ? null : new Date() }
        : task,
    ),
  }))
}

function ObjectiveView({ data, goals }: { data: LandingDemoData; goals: DemoGoal[] }) {
  const { objective, today } = data
  const tasks = goals.flatMap((goal) => goal.dailyTasks)
  const done = tasks.filter((task) => task.completed).length
  const total = objective.targetDate ? differenceInAppDays(objective.targetDate, objective.startDate) : 0
  const elapsed =
    total > 0
      ? Math.min(100, Math.max(0, Math.round((differenceInAppDays(today, objective.startDate) / total) * 100)))
      : 0

  return (
    <div className="flex overflow-hidden rounded-lg border border-border bg-card">
      <div className="w-[3px] shrink-0 bg-primary" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-sm font-semibold">{objective.title}</p>
          {objective.targetDate && (
            <p className="text-xs text-muted-foreground">Prazo: {formatDate(objective.targetDate)}</p>
          )}
        </div>
        <div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Prazo decorrido"
            aria-valuenow={elapsed}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${elapsed}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{elapsed}% do prazo decorrido</p>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {done} de {tasks.length} tarefas da semana concluídas
        </p>
      </div>
    </div>
  )
}

function WeekView({ goals }: { goals: DemoGoal[] }) {
  return (
    <div className="flex flex-col gap-3">
      {goals.map((goal) => (
        <WeekGoalProgressCard key={goal.id} goal={goal} />
      ))}
    </div>
  )
}

function TodayView({
  today,
  goals,
  onToggle,
}: {
  today: Date
  goals: DemoGoal[]
  onToggle: (id: string) => Promise<void>
}) {
  const tasks = goals.flatMap((goal) =>
    goal.dailyTasks.filter((task) => isSameAppDay(task.date, today)).map((task) => ({ ...task, weeklyGoal: goal })),
  )
  return (
    <div className="flex flex-col gap-3">
      {groupTasksByWeeklyGoal(tasks).map((group) => (
        <TodayTaskGroup key={group.weeklyGoal.id} group={group} onToggleTask={onToggle} />
      ))}
    </div>
  )
}

export function LandingDemo({ data, step }: { data: LandingDemoData; step: DemoStep }) {
  const [goals, setGoals] = useState<DemoGoal[]>(data.goals)
  const [ticked, setTicked] = useState(false)
  const region = useRef<HTMLDivElement>(null)

  // The real cards link to pages a visitor cannot open: keep the links out of
  // the tab order too (clicks are cancelled by the capture handler below).
  useEffect(() => {
    region.current?.querySelectorAll('a').forEach((link) => link.setAttribute('tabindex', '-1'))
  }, [step, goals])

  async function onToggle(id: string) {
    setGoals((current) => toggleTask(current, id))
    setTicked(true)
  }

  function reset() {
    setGoals(data.goals)
    setTicked(false)
  }

  return (
    <div
      ref={region}
      role="region"
      aria-label="Demonstração interativa"
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest('a')) event.preventDefault()
      }}
      className="flex flex-col gap-3 [&_a]:cursor-default"
    >
      <div key={step} className="landing-view">
        {step === 0 && <ObjectiveView data={data} goals={goals} />}
        {step === 1 && <WeekView goals={goals} />}
        {step === 2 && <TodayView today={data.today} goals={goals} onToggle={onToggle} />}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{step === 2 && !ticked ? 'Experimente: marque uma tarefa' : ''}</p>
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          Recomeçar
        </Button>
      </div>
    </div>
  )
}
