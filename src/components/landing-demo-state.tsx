'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { DemoGoal, LandingDemoData } from '@/lib/landing-demo'

type DemoState = {
  goals: DemoGoal[]
  /** Whether the visitor has ticked anything yet (drives the hint). */
  ticked: boolean
  toggle: (taskId: string) => Promise<void>
  reset: () => void
}

const DemoStateContext = createContext<DemoState | null>(null)

export function useDemoState(): DemoState {
  const state = useContext(DemoStateContext)
  if (!state) throw new Error('useDemoState must be used inside DemoStateProvider')
  return state
}

export function useHasDemoState(): boolean {
  return useContext(DemoStateContext) !== null
}

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

/** The demo's tasks, in memory and shared by every view that shows them (panel and cards alike). */
export function DemoStateProvider({ data, children }: { data: LandingDemoData; children: ReactNode }) {
  const [goals, setGoals] = useState<DemoGoal[]>(data.goals)
  const [ticked, setTicked] = useState(false)

  async function toggle(taskId: string) {
    setGoals((current) => toggleTask(current, taskId))
    setTicked(true)
  }

  function reset() {
    setGoals(data.goals)
    setTicked(false)
  }

  return <DemoStateContext value={{ goals, ticked, toggle, reset }}>{children}</DemoStateContext>
}

/**
 * Wraps demo content that reuses the app's real cards. Those link to pages a
 * visitor cannot open, so clicks on anchors are cancelled and the anchors leave
 * the tab order.
 */
export function DemoGuard({ children, className }: { children: ReactNode; className?: string }) {
  const area = useRef<HTMLDivElement>(null)

  useEffect(() => {
    area.current?.querySelectorAll('a').forEach((link) => link.setAttribute('tabindex', '-1'))
  })

  return (
    <div
      ref={area}
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest('a')) event.preventDefault()
      }}
      className={className}
    >
      {children}
    </div>
  )
}
