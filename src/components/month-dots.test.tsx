import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MonthDots } from '@/components/month-dots'
import { getYearDays, parseDay } from '@/lib/dates'
import { buildDayDots, type DayDotsYear } from '@/lib/day-dots'

vi.mock('@/lib/actions/stats', () => ({ getDayDots: vi.fn() }))

const now = new Date('2026-10-20T15:00:00Z')

function yearData(done: string[]): DayDotsYear {
  const tasks = done.map((key) => ({ date: parseDay(key), completed: true }))
  return { year: 2026, dots: buildDayDots(tasks, getYearDays(2026), now), daysDone: done.length, firstYear: 2026, currentYear: 2026 }
}

describe('MonthDots', () => {
  it('shows the month as a labelled grid with leading blanks', () => {
    const { container } = render(<MonthDots data={yearData(['2026-10-05', '2026-10-06', '2026-09-30'])} now={now} />)

    expect(screen.getByRole('heading', { name: 'outubro de 2026' })).toBeInTheDocument()
    const grid = screen.getByRole('img', { name: 'outubro de 2026: 2 de 20 dias feitos' })
    expect(grid.children).toHaveLength(3 + 31) // Oct 1 2026 is a Thursday
    expect(container.querySelector('[data-current-day]')?.getAttribute('title')).toBe('20/10/2026 · Nada feito')
    expect(screen.getByText('2 de 20 dias feitos')).toBeInTheDocument()
    expect(screen.queryByText(/Seu primeiro ponto/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver o ano' })).toBeInTheDocument()
  })

  it('gives a hint while no day is done yet', () => {
    render(<MonthDots data={yearData([])} now={now} />)
    expect(
      screen.getByText('Seu primeiro ponto acende quando você concluir 60% das tarefas de um dia.'),
    ).toBeInTheDocument()
  })
})
