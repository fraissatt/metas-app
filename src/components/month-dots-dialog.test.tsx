import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MonthDotsDialog } from '@/components/month-dots-dialog'
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

const open = () => userEvent.click(screen.getByRole('button', { name: 'Ver o mês' }))

describe('MonthDotsDialog', () => {
  it('opens on the current month with its grid, legend and total', async () => {
    render(<MonthDotsDialog initial={yearData(2026, 2026, ['2026-10-05', '2026-10-06'])} loadYear={vi.fn()} />)
    await open()

    expect(screen.getByRole('dialog', { name: 'outubro de 2026' })).toBeInTheDocument()
    const grid = screen.getByRole('img', { name: 'outubro de 2026: 2 de 20 dias feitos' })
    expect(grid.children).toHaveLength(3 + 31) // Oct 1 2026 is a Thursday
    expect(screen.getByText('2 de 20 dias feitos')).toBeInTheDocument()
    expect(screen.getByText('Dia feito')).toBeInTheDocument()
    expect(screen.queryByText(/Seu primeiro ponto/)).not.toBeInTheDocument()
  })

  it('moves back a month and forward again, stopping on the current month', async () => {
    const loadYear = vi.fn()
    render(<MonthDotsDialog initial={yearData(2026, 2026, ['2026-09-10'])} loadYear={loadYear} />)
    await open()

    await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }))
    expect(screen.getByRole('dialog', { name: 'setembro de 2026' })).toBeInTheDocument()
    expect(screen.getByText('1 de 30 dias feitos')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(screen.getByRole('dialog', { name: 'outubro de 2026' })).toBeInTheDocument()
    const next = screen.getByRole('button', { name: 'Próximo mês' })
    expect(next).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(next)
    expect(screen.getByRole('dialog', { name: 'outubro de 2026' })).toBeInTheDocument()
    expect(loadYear).not.toHaveBeenCalled()
  })

  it('loads the previous year when going back past January and stops at the first January', async () => {
    const loadYear = vi.fn(async () => yearData(2025, 2025))
    render(<MonthDotsDialog initial={yearData(2026, 2025)} loadYear={loadYear} />)
    await open()

    for (let i = 0; i < 9; i++) await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' })) // → janeiro de 2026
    expect(loadYear).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }))
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'dezembro de 2025' })).toBeInTheDocument())
    expect(loadYear).toHaveBeenCalledWith(2025)

    for (let i = 0; i < 11; i++) {
      await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }))
    }
    expect(screen.getByRole('dialog', { name: 'janeiro de 2025' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toHaveAttribute('aria-disabled', 'true')
  }, 20_000)

  it('does not skip or repeat a month when two clicks come while a year is loading', async () => {
    const pending: Array<(data: DayDotsYear) => void> = []
    const loadYear = vi.fn(() => new Promise<DayDotsYear>((resolve) => pending.push(resolve)))
    render(<MonthDotsDialog initial={yearData(2026, 2025)} loadYear={loadYear} />)
    await open()
    for (let i = 0; i < 9; i++) await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' })) // → janeiro de 2026

    await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' })) // → dezembro de 2025, loading
    await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' })) // → novembro de 2025, still loading
    await act(async () => pending.forEach((resolve) => resolve(yearData(2025, 2025))))

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'novembro de 2025' })).toBeInTheDocument())
  }, 20_000)

  it('shows the first-dot hint only while no day is done', async () => {
    const { unmount } = render(<MonthDotsDialog initial={yearData(2026, 2026)} loadYear={vi.fn()} />)
    await open()
    expect(
      screen.getByText('Seu primeiro ponto acende quando você concluir 60% das tarefas de um dia.'),
    ).toBeInTheDocument()
    unmount()

    render(<MonthDotsDialog initial={yearData(2026, 2026, ['2026-10-05'])} loadYear={vi.fn()} />)
    await open()
    expect(screen.queryByText(/Seu primeiro ponto/)).not.toBeInTheDocument()
  })

  it('announces the month, closes with Escape and returns focus to the button', async () => {
    render(<MonthDotsDialog initial={yearData(2026, 2026)} loadYear={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'Ver o mês' })
    await userEvent.click(trigger)
    expect(screen.getByRole('heading', { name: 'outubro de 2026' })).toHaveAttribute('aria-live', 'polite')

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('opens on the latest data after the page refreshes it', async () => {
    const { rerender } = render(<MonthDotsDialog initial={yearData(2026, 2026)} loadYear={vi.fn()} />)
    rerender(<MonthDotsDialog initial={yearData(2026, 2026, ['2026-10-20'])} loadYear={vi.fn()} />)
    await open()

    expect(screen.getByText('1 de 20 dias feitos')).toBeInTheDocument()
  })
})
