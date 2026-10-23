import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { YearDotsCard } from '@/components/year-dots-card'
import { getYearDays, parseDay } from '@/lib/dates'
import { buildDayDots, type DayDotsYear } from '@/lib/day-dots'

const now = new Date('2026-10-20T15:00:00Z')

function yearData(year: number, firstYear: number, done: string[] = []): DayDotsYear {
  const tasks = done.map((key) => ({ date: parseDay(key), completed: true }))
  return {
    year,
    dots: buildDayDots(tasks, getYearDays(year), now),
    daysDone: done.length,
    firstYear,
    currentYear: 2026,
  }
}

describe('YearDotsCard', () => {
  it('shows the year as a labelled grid with its total and the month button', () => {
    render(<YearDotsCard initial={yearData(2026, 2026, ['2026-10-05', '2026-10-06'])} loadYear={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '2026' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '2026: 2 dias feitos' })).toBeInTheDocument()
    expect(screen.getByText('2 dias feitos em 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver o mês' })).toBeInTheDocument()
    expect(screen.getByText('Dia feito')).toBeInTheDocument()
    expect(screen.queryByText(/Seu primeiro ponto/)).not.toBeInTheDocument()
  })

  it('moves to a previous year and back, keeping the arrows focusable at the ends', async () => {
    const loadYear = vi.fn(async (year: number) =>
      year === 2025 ? yearData(2025, 2025, ['2025-03-01']) : yearData(2026, 2025),
    )
    render(<YearDotsCard initial={yearData(2026, 2025)} loadYear={loadYear} />)

    const next = screen.getByRole('button', { name: 'Próximo ano' })
    expect(next).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(next)
    expect(loadYear).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Ano anterior' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: '2025' })).toBeInTheDocument())
    expect(loadYear).toHaveBeenCalledWith(2025)
    expect(screen.getByText('1 dia feito em 2025')).toBeInTheDocument()

    const previous = screen.getByRole('button', { name: 'Ano anterior' })
    expect(previous).toHaveAttribute('aria-disabled', 'true')
    previous.focus()
    await userEvent.click(previous)
    expect(previous).toHaveFocus()

    await userEvent.click(screen.getByRole('button', { name: 'Próximo ano' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: '2026' })).toBeInTheDocument())
  })

  it('hides the arrows when there is only one year and announces year changes', () => {
    render(<YearDotsCard initial={yearData(2026, 2026)} loadYear={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Ano anterior' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Próximo ano' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2026' })).toHaveAttribute('aria-live', 'polite')
  })

  it('shows the new data when the page re-renders with a new initial', () => {
    const { rerender } = render(<YearDotsCard initial={yearData(2026, 2026)} loadYear={vi.fn()} />)
    expect(screen.getByText('0 dias feitos em 2026')).toBeInTheDocument()

    rerender(<YearDotsCard initial={yearData(2026, 2026, ['2026-10-20'])} loadYear={vi.fn()} />)

    expect(screen.getByRole('img', { name: '2026: 1 dia feito' })).toBeInTheDocument()
    expect(screen.getByText('1 dia feito em 2026')).toBeInTheDocument()
  })

  it('gives the first-dot hint only while no day is done', () => {
    const { unmount } = render(<YearDotsCard initial={yearData(2026, 2026)} loadYear={vi.fn()} />)
    expect(
      screen.getByText('Seu primeiro ponto acende quando você concluir 60% das tarefas de um dia.'),
    ).toBeInTheDocument()
    unmount()

    render(<YearDotsCard initial={yearData(2026, 2026, ['2026-10-05'])} loadYear={vi.fn()} />)
    expect(screen.queryByText(/Seu primeiro ponto/)).not.toBeInTheDocument()
  })

  it('drops its own frame when it sits in a panel, and keeps it by default', () => {
    const { rerender } = render(<YearDotsCard initial={yearData(2026, 2026)} loadYear={vi.fn()} flat />)
    const region = () => screen.getByRole('region', { name: 'Calendário do ano' })
    expect(region()).not.toHaveClass('rounded-lg')
    expect(region()).not.toHaveClass('border')
    expect(region()).not.toHaveClass('bg-card')

    rerender(<YearDotsCard initial={yearData(2026, 2026)} loadYear={vi.fn()} />)
    expect(region()).toHaveClass('rounded-lg', 'border', 'bg-card')
  })
})
