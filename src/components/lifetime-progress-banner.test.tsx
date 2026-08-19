import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LifetimeProgressBanner } from '@/components/lifetime-progress-banner'

const week = (monthIndex: number, day: number, active: boolean) => ({
  weekStart: new Date(2026, monthIndex, day),
  active,
})

describe('LifetimeProgressBanner', () => {
  it('shows the lifetime count and the date of the first completion', () => {
    render(
      <LifetimeProgressBanner
        totalCompleted={247}
        firstCompletedAt={new Date(2026, 6, 29, 10)}
        weekWindow={[week(7, 17, true)]}
      />,
    )

    expect(screen.getByText('247')).toBeInTheDocument()
    expect(screen.getByText(/tarefas concluídas desde 29\/07\/2026/)).toBeInTheDocument()
  })

  it('uses the singular form for a single completed task', () => {
    render(
      <LifetimeProgressBanner
        totalCompleted={1}
        firstCompletedAt={new Date(2026, 7, 18, 10)}
        weekWindow={[week(7, 17, true)]}
      />,
    )

    expect(screen.getByText(/tarefa concluída desde 18\/08\/2026/)).toBeInTheDocument()
  })

  it('renders one dot per week, marking active weeks apart from inactive ones', () => {
    render(
      <LifetimeProgressBanner
        totalCompleted={12}
        firstCompletedAt={new Date(2026, 7, 3, 10)}
        weekWindow={[week(7, 3, true), week(7, 10, false), week(7, 17, true)]}
      />,
    )

    const dots = screen.getAllByTestId('week-dot')

    expect(dots).toHaveLength(3)
    expect(dots.map((dot) => dot.getAttribute('data-active'))).toEqual(['true', 'false', 'true'])
  })

  it('summarises how many of the windowed weeks were active', () => {
    render(
      <LifetimeProgressBanner
        totalCompleted={12}
        firstCompletedAt={new Date(2026, 7, 3, 10)}
        weekWindow={[week(7, 3, true), week(7, 10, false), week(7, 17, true)]}
      />,
    )

    expect(screen.getByText('2 das últimas 3 semanas')).toBeInTheDocument()
  })

  it('greets a first-week user instead of showing a one-week ratio', () => {
    render(
      <LifetimeProgressBanner
        totalCompleted={3}
        firstCompletedAt={new Date(2026, 7, 18, 10)}
        weekWindow={[week(7, 17, true)]}
      />,
    )

    expect(screen.getByText('Sua primeira semana')).toBeInTheDocument()
    expect(screen.queryByText(/das últimas/)).not.toBeInTheDocument()
  })
})
