import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeeklyBars, barLabel } from '@/components/weekly-bars'
import type { DashboardWeek } from '@/lib/objective-dashboard'

function w(day: number, completed: number, total: number, extra: Partial<DashboardWeek> = {}): DashboardWeek {
  return {
    weekStart: new Date(2026, 8, day),
    completed,
    total,
    fulfilled: total > 0 && completed === total,
    percent: total ? Math.round((completed / total) * 100) : 0,
    hasGoal: total > 0,
    current: false,
    ...extra,
  }
}

const weeks: DashboardWeek[] = [w(7, 5, 5), w(14, 0, 0), w(21, 3, 5), w(28, 2, 4, { current: true })]

describe('barLabel', () => {
  it('describes fulfilled, partial, empty and current weeks', () => {
    expect(barLabel(weeks[0])).toBe('07/09 · 5/5 ✓')
    expect(barLabel(weeks[1])).toBe('14/09 · sem meta')
    expect(barLabel(weeks[2])).toBe('21/09 · 3/5')
    expect(barLabel(weeks[3])).toBe('28/09 · 2/4 (em andamento)')
  })
})

describe('WeeklyBars', () => {
  it('renders one labeled bar per week inside a named group', () => {
    render(<WeeklyBars weeks={weeks} />)

    expect(screen.getByRole('group', { name: 'Últimas 8 semanas' })).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(4)
    expect(screen.getByRole('img', { name: '21/09 · 3/5' })).toBeInTheDocument()
  })

  it('shows the tooltip on hover and on keyboard focus', async () => {
    render(<WeeklyBars weeks={weeks} />)

    await userEvent.hover(screen.getByRole('img', { name: '07/09 · 5/5 ✓' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('07/09 · 5/5 ✓')

    await userEvent.unhover(screen.getByRole('img', { name: '07/09 · 5/5 ✓' }))
    await userEvent.tab()
    expect(screen.getByRole('tooltip')).toHaveTextContent('07/09 · 5/5 ✓')
    await userEvent.tab()
    expect(screen.getByRole('tooltip')).toHaveTextContent('14/09 · sem meta')
  })
})
