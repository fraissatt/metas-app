import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SmallStepsSection } from '@/components/small-steps-section'
import { getYearDays, parseDay } from '@/lib/dates'
import { buildDayDots } from '@/lib/day-dots'

vi.mock('@/lib/actions/stats', () => ({ getDayDots: vi.fn() }))

const now = new Date('2026-10-20T15:00:00Z')

function data(done: string[]) {
  const tasks = done.map((key) => ({ date: parseDay(key), completed: true }))
  return { year: 2026, dots: buildDayDots(tasks, getYearDays(2026), now), daysDone: done.length, firstYear: 2026, currentYear: 2026 }
}

describe('SmallStepsSection', () => {
  it('gathers the compound effect, the year and the month button under one heading', () => {
    render(<SmallStepsSection data={data(['2026-10-05'])} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Seus pequenos passos' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Efeito composto' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '2026: 1 dia feito' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver o mês' })).toBeInTheDocument()
  })

  it('invites a new user instead of showing an empty block', () => {
    render(<SmallStepsSection data={data([])} />)

    expect(screen.getByText('Cada dia feito soma 1%. Em um ano, isso vira 37×.')).toBeInTheDocument()
    expect(screen.getByText(/Seu primeiro ponto acende/)).toBeInTheDocument()
  })

  it('puts the compound effect and the year in one panel', () => {
    render(<SmallStepsSection data={data(['2026-10-05'])} />)

    const panel = screen.getByRole('region', { name: 'Efeito composto' }).closest('.divide-y')
    expect(panel).not.toBeNull()
    expect(panel).toContainElement(screen.getByRole('region', { name: 'Calendário do ano' }))
  })
})
