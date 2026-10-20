import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { YearDotsDialog } from '@/components/year-dots-dialog'
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

describe('YearDotsDialog', () => {
  it('opens on the current year with its grid and total', async () => {
    render(<YearDotsDialog initial={yearData(2026, 2026, ['2026-10-05', '2026-10-06'])} loadYear={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ver o ano' }))

    expect(screen.getByRole('dialog', { name: '2026' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '2026: 2 dias feitos' })).toBeInTheDocument()
    expect(screen.getByText('2 dias feitos em 2026')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ano anterior' })).not.toBeInTheDocument()
  })

  it('moves to a previous year and back, disabling the arrows at the ends', async () => {
    const loadYear = vi.fn(async (year: number) =>
      year === 2025 ? yearData(2025, 2025, ['2025-03-01']) : yearData(2026, 2025),
    )
    render(<YearDotsDialog initial={yearData(2026, 2025)} loadYear={loadYear} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ver o ano' }))

    expect(screen.getByRole('button', { name: 'Próximo ano' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Ano anterior' }))

    await waitFor(() => expect(screen.getByRole('dialog', { name: '2025' })).toBeInTheDocument())
    expect(loadYear).toHaveBeenCalledWith(2025)
    expect(screen.getByText('1 dia feito em 2025')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ano anterior' })).toBeDisabled()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Próximo ano' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'Próximo ano' }))
    await waitFor(() => expect(screen.getByRole('dialog', { name: '2026' })).toBeInTheDocument())
  })

  it('returns focus to the trigger when closed', async () => {
    render(<YearDotsDialog initial={yearData(2026, 2026)} loadYear={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'Ver o ano' })
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('opens on the latest data after the page refreshes it', async () => {
    const { rerender } = render(<YearDotsDialog initial={yearData(2026, 2026)} loadYear={vi.fn()} />)
    rerender(<YearDotsDialog initial={yearData(2026, 2026, ['2026-10-20'])} loadYear={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ver o ano' }))

    expect(screen.getByText('1 dia feito em 2026')).toBeInTheDocument()
  })
})
