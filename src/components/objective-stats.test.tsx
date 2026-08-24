import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ObjectiveStatsPanel } from '@/components/objective-stats'

const week = (day: number, fulfilled: boolean) => ({
  weekStart: new Date(2026, 7, day),
  total: 3,
  completed: fulfilled ? 3 : 1,
  fulfilled,
})

const stats = {
  weeksFulfilled: 2,
  tasksCompleted: 312,
  weeksSinceStart: 104,
  recentWeeks: [week(3, true), week(10, false), week(17, true)],
}

describe('ObjectiveStatsPanel', () => {
  it('shows fulfilled weeks, completed tasks and how long the objective has run', () => {
    render(<ObjectiveStatsPanel stats={stats} />)

    expect(screen.getByText(/2 semanas cumpridas/)).toBeInTheDocument()
    expect(screen.getByText(/312 tarefas/)).toBeInTheDocument()
    expect(screen.getByText(/104 semanas/)).toBeInTheDocument()
  })

  it('renders one strip segment per week, fulfilled ones marked apart', () => {
    render(<ObjectiveStatsPanel stats={stats} />)

    const segments = screen.getAllByTestId('week-segment')

    expect(segments).toHaveLength(3)
    expect(segments.map((s) => s.getAttribute('data-fulfilled'))).toEqual(['true', 'false', 'true'])
  })

  it('uses the singular for a single fulfilled week', () => {
    render(<ObjectiveStatsPanel stats={{ ...stats, weeksFulfilled: 1 }} />)

    expect(screen.getByText(/1 semana cumprida/)).toBeInTheDocument()
  })

  it('omits the strip in compact mode', () => {
    render(<ObjectiveStatsPanel stats={stats} compact />)

    expect(screen.getByText(/2 semanas cumpridas/)).toBeInTheDocument()
    expect(screen.queryAllByTestId('week-segment')).toHaveLength(0)
  })
})
