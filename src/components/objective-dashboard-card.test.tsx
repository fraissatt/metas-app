import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ObjectiveDashboardCard } from '@/components/objective-dashboard-card'
import type { DashboardWeek } from '@/lib/objective-dashboard'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

function weeks(currentHasGoal: boolean): DashboardWeek[] {
  return Array.from({ length: 8 }, (_, i) => ({
    weekStart: new Date(2026, 7, 10 + i * 7),
    completed: i === 7 && !currentHasGoal ? 0 : 3,
    total: i === 7 && !currentHasGoal ? 0 : 4,
    fulfilled: false,
    percent: i === 7 && !currentHasGoal ? 0 : 75,
    hasGoal: i === 7 ? currentHasGoal : true,
    current: i === 7,
  }))
}

const base = {
  id: 'o1',
  title: 'Correr uma maratona',
  startDate: new Date(2026, 5, 1),
  onDelete: vi.fn(),
}

describe('ObjectiveDashboardCard', () => {
  it('links the title, shows the streak, the 8-week rate and the plan shortcut', () => {
    render(
      <ObjectiveDashboardCard
        {...base}
        weeks={weeks(true)}
        streak={3}
        timeline={{ kind: 'dated', elapsedPercent: 62, targetDate: new Date(2026, 10, 15), overdue: false }}
      />,
    )

    expect(screen.getByRole('link', { name: 'Correr uma maratona' })).toHaveAttribute('href', '/objectives/o1')
    expect(screen.getByRole('link', { name: 'Correr uma maratona' })).toHaveClass('line-clamp-2')
    expect(screen.getByText('3 semanas seguidas cumpridas')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('média das últimas 8 semanas')).toBeInTheDocument()
    expect(screen.getByText('início 01/06 · 62% do prazo · meta 15/11')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+ Meta da semana' })).toHaveAttribute('href', '/objectives/o1?nova-meta=1#nova-meta')
    expect(screen.getByRole('button', { name: 'Ações do objetivo' })).toBeInTheDocument()
  })

  it('nudges to plan when the current week has no goal and there is no streak', () => {
    render(<ObjectiveDashboardCard {...base} weeks={weeks(false)} streak={0} timeline={{ kind: 'open', weeksActive: 5 }} />)

    expect(screen.getByText('sem meta nesta semana')).toBeInTheDocument()
    expect(screen.getByText('início 01/06 · ativo há 5 semanas · sem data-meta')).toBeInTheDocument()
  })

  it('shows no chip when there is a goal this week but no streak, and marks an overdue target', () => {
    render(
      <ObjectiveDashboardCard
        {...base}
        weeks={weeks(true)}
        streak={0}
        timeline={{ kind: 'dated', elapsedPercent: 100, targetDate: new Date(2026, 8, 1), overdue: true }}
      />,
    )

    expect(screen.queryByText('sem meta nesta semana')).not.toBeInTheDocument()
    expect(screen.queryByText(/semanas seguidas/)).not.toBeInTheDocument()
    expect(screen.getByText('prazo encerrado')).toBeInTheDocument()
  })

  it('shows a dash when nothing was planned in 8 weeks', () => {
    const empty = weeks(false).map((w) => ({ ...w, completed: 0, total: 0, percent: 0, hasGoal: false }))
    render(<ObjectiveDashboardCard {...base} weeks={empty} streak={0} timeline={{ kind: 'open', weeksActive: 1 }} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('início 01/06 · ativo há 1 semana · sem data-meta')).toBeInTheDocument()
  })
})
