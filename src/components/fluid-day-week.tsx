'use client'

import { useCallback, useOptimistic, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
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
type ToggleState = { tasks: DailyTasks; goals: WeeklyGoals }

export function toggleTaskOptimistic(state: ToggleState, taskId: string): ToggleState {
  return {
    tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task)),
    goals: state.goals.map((goal) => ({
      ...goal,
      dailyTasks: goal.dailyTasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task,
      ),
    })),
  }
}

export function useIsDesktop(breakpointPx = 1024): boolean {
  // Lazily create and cache one MediaQueryList per breakpoint instead of
  // calling matchMedia on every subscribe/getSnapshot invocation. The
  // factory only runs when subscribe/getSnapshot are actually invoked
  // (client-side, via useSyncExternalStore) — never during the render
  // pass itself, so this stays safe under SSR where `window` is undefined.
  // Cache is keyed by breakpointPx so a caller that varies the breakpoint
  // across renders doesn't get stuck querying a stale MediaQueryList.
  const mqlRef = useRef<{ breakpointPx: number; mql: MediaQueryList } | null>(null)
  const getMql = useCallback(() => {
    if (!mqlRef.current || mqlRef.current.breakpointPx !== breakpointPx) {
      mqlRef.current = { breakpointPx, mql: window.matchMedia(`(min-width: ${breakpointPx}px)`) }
    }
    return mqlRef.current.mql
  }, [breakpointPx])

  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = getMql()
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [getMql],
  )
  const getSnapshot = useCallback(() => getMql().matches, [getMql])
  const getServerSnapshot = useCallback(() => false, [])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function FluidDayWeek({
  tasks,
  goals,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
}: {
  tasks: DailyTasks
  goals: WeeklyGoals
  onToggleTask: (id: string) => Promise<void>
  onUpdateTask?: (id: string, formData: FormData) => Promise<void>
  onDeleteTask?: (id: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const isDesktop = useIsDesktop()
  const effectiveExpanded = expanded || isDesktop
  const [optimisticState, applyOptimisticToggle] = useOptimistic({ tasks, goals }, toggleTaskOptimistic)

  async function handleToggle(taskId: string) {
    applyOptimisticToggle(taskId)
    await onToggleTask(taskId)
  }

  const todayGroups = groupTasksByWeeklyGoal(optimisticState.tasks)
  const todayGoalIds = todayGroups.map((group) => group.weeklyGoal.id)
  const goalsWithTasksToday = todayGoalIds
    .map((id) => optimisticState.goals.find((goal) => goal.id === id))
    .filter((goal): goal is WeeklyGoals[number] => goal !== undefined)
  const otherGoals = optimisticState.goals.filter((goal) => !todayGoalIds.includes(goal.id))

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <div className="lg:basis-3/5">
        <h1 className="mb-6 text-2xl font-semibold">Hoje</h1>
        {optimisticState.tasks.length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-muted-foreground">Nenhuma tarefa para hoje.</p>
            <Link href="/objectives" className="text-sm font-medium text-accent-foreground hover:underline">
              + Adicionar tarefa a uma meta
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {todayGroups.map((group) => (
              <TodayTaskGroup
                key={group.weeklyGoal.id}
                group={group}
                onToggleTask={handleToggle}
                onUpdateTask={onUpdateTask}
                onDeleteTask={onDeleteTask}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:basis-2/5">
        <Button
          type="button"
          variant="outline"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="week-section"
          className="w-full border-dashed border-primary text-accent-foreground hover:bg-primary/10 hover:text-accent-foreground lg:hidden"
        >
          {expanded ? 'Recolher semana' : 'Ver semana'}
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>

        <div
          id="week-section"
          aria-hidden={!effectiveExpanded}
          className={cn(
            'grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none',
            effectiveExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden" inert={!effectiveExpanded}>
            <h2 className="mb-6 text-2xl font-semibold">Progresso da semana</h2>
            {optimisticState.goals.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma meta semanal para esta semana.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {goalsWithTasksToday.map((goal) => (
                  <WeekGoalProgressCard key={goal.id} goal={goal} />
                ))}
                {goalsWithTasksToday.length > 0 && otherGoals.length > 0 && (
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    outras metas da semana
                  </p>
                )}
                {otherGoals.map((goal) => (
                  <WeekGoalProgressCard key={goal.id} goal={goal} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
