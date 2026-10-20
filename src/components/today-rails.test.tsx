import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TodayRails } from '@/components/today-rails'
import { getYearDays } from '@/lib/dates'
import { buildDayDots } from '@/lib/day-dots'

vi.mock('@/lib/actions/stats', () => ({ getDayDots: vi.fn() }))

const data = {
  year: 2026,
  dots: buildDayDots([], getYearDays(2026), new Date('2026-10-20T15:00:00Z')),
  daysDone: 0,
  firstYear: 2026,
  currentYear: 2026,
}

describe('TodayRails', () => {
  it('keeps the content and adds both rails, hidden below 2xl', () => {
    render(
      <TodayRails data={data} width="wide">
        <main>conteúdo</main>
      </TodayRails>,
    )

    expect(screen.getByRole('main')).toHaveTextContent('conteúdo')
    // A grid item with auto margins shrinks to its content unless told to fill.
    expect(screen.getByRole('main').parentElement).toHaveClass('[&>main]:w-full')
    for (const name of ['Efeito composto', 'Calendário']) {
      const rail = screen.getByRole('complementary', { name })
      expect(rail).toHaveClass('hidden', '2xl:block')
    }
  })
})
