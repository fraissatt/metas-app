'use client'

import type { CSSProperties } from 'react'
import { useCardProgress } from '@/components/landing-card-progress'
import { DemoGuard, useDemoState } from '@/components/landing-demo-state'
import { TodayTaskGroup } from '@/components/today-task-group'
import { WeekGoalProgressCard } from '@/components/week-goal-progress-card'
import { Button } from '@/components/ui/button'
import { differenceInAppDays, formatDate, formatDayMonth, isSameAppDay } from '@/lib/dates'
import type { DemoGoal, LandingDemoData } from '@/lib/landing-demo'
import { groupTasksByWeeklyGoal } from '@/lib/tasks'

export const HINT = 'Experimente: marque uma tarefa'

function showWeekCard() {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  document
    .querySelector('[data-card="1"]')
    ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
}

/**
 * `t` (0 to 1) is how far the view has been revealed: 1 shows the final numbers,
 * and on phones it grows with the scroll so the numbers count up and the bars rise.
 */
export function ObjectiveView({ data, goals, t = 1 }: { data: LandingDemoData; goals: DemoGoal[]; t?: number }) {
  const { objective, today, weeks } = data
  const tasks = goals.flatMap((goal) => goal.dailyTasks)
  const done = tasks.filter((task) => task.completed).length
  const currentRate = tasks.length === 0 ? 0 : done / tasks.length
  const total = objective.targetDate ? differenceInAppDays(objective.targetDate, objective.startDate) : 0
  const elapsed =
    total > 0
      ? Math.min(100, Math.max(0, Math.round((differenceInAppDays(today, objective.startDate) / total) * 100)))
      : 0
  const fulfilled = weeks.filter((week) => week.rate === 1).length
  let streak = 0
  for (let index = weeks.length - 1; index >= 0 && weeks[index].rate === 1; index--) streak++

  // The bars grow with the view's visibility (--w), so they rise as the view appears.
  const bar = (rate: number): CSSProperties => ({ height: `max(8%, calc(${rate} * var(--w, 1) * 100%))` })
  const count = (value: number) => Math.round(value * t)
  // The current week's bar glows while it rises and calms once it has arrived.
  const pulse = Math.sin(Math.PI * Math.min(1, Math.max(0, t)))

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
            <div className="h-full rounded-full bg-primary" style={{ width: `${elapsed * t}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">{count(elapsed)}% do prazo decorrido</p>
        </div>
        <div>
          <div className="flex h-14 items-end gap-1.5" aria-hidden="true">
            {weeks.map((week) => (
              <div
                key={week.weekStart.toISOString()}
                data-testid="week-bar"
                title={`Semana de ${formatDayMonth(week.weekStart)}: ${Math.round(week.rate * 100)}%`}
                className="flex-1 rounded-t-sm bg-primary/50"
                style={bar(week.rate)}
              />
            ))}
            <div
              data-testid="week-bar"
              title={`Esta semana: ${Math.round(currentRate * 100)}%`}
              className="flex-1 rounded-t-sm bg-primary"
              style={{ ...bar(currentRate), boxShadow: `0 0 ${Math.round(14 * pulse)}px var(--primary)` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {count(fulfilled)} de {weeks.length} semanas cumpridas · sequência de {count(streak)}
          </p>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {count(done)} de {tasks.length} tarefas da semana concluídas
        </p>
      </div>
    </div>
  )
}

export function WeekView({ goals, t = 1 }: { goals: DemoGoal[]; t?: number }) {
  // The real cards, filling smoothly with `t`, each with a glow that swells while it fills and calms at its real value.
  const glow = Math.sin(Math.PI * Math.min(1, Math.max(0, t)))
  return (
    <div className="flex flex-col gap-3">
      {goals.map((goal) => (
        <div
          key={goal.id}
          data-testid="goal-glow"
          className="rounded-lg"
          style={{ boxShadow: `0 0 ${Math.round(22 * glow)}px color-mix(in oklab, var(--primary) ${Math.round(45 * glow)}%, transparent)` }}
        >
          <WeekGoalProgressCard goal={goal} reveal={t} />
        </div>
      ))}
    </div>
  )
}

export function TodayView({
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

/**
 * One step's demo: a card that stays in the page flow beside (desktop) or under
 * (phones) its step, and whose content (bars, rings, numbers) follows the scroll through `t`.
 */
export function DemoCard({ index, data, label }: { index: 0 | 1 | 2; data: LandingDemoData; label: string }) {
  const { goals, ticked, toggle, reset } = useDemoState()
  const t = useCardProgress(index)
  const entrance = Math.min(1, t * 2.5)

  return (
    <div
      data-card={index}
      role="group"
      aria-label={label}
      style={{ '--w': t, opacity: entrance, transform: `translateY(${(1 - entrance) * 16}px)` } as CSSProperties}
    >
      <DemoGuard className="flex flex-col gap-2 [&_a]:cursor-default">
        {index === 0 && <ObjectiveView data={data} goals={goals} t={t} />}
        {index === 1 && <WeekView goals={goals} t={t} />}
        {index === 2 && (
          <>
            <TodayView today={data.today} goals={goals} onToggle={toggle} />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {ticked ? (
                  <>
                    Feito!{' '}
                    <button
                      type="button"
                      onClick={showWeekCard}
                      className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                    >
                      Ver a Meta da semana
                    </button>{' '}
                    avançar.
                  </>
                ) : (
                  HINT
                )}
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                Recomeçar
              </Button>
            </div>
          </>
        )}
      </DemoGuard>
    </div>
  )
}
