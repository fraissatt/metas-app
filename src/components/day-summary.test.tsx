import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DaySummary } from '@/components/day-summary'

const weekStart = new Date(2026, 8, 28)

describe('DaySummary', () => {
  it("shows today's progress and the week, linking to Hoje", () => {
    render(<DaySummary completed={3} total={5} weekStart={weekStart} />)

    const link = screen.getByRole('link', { name: '3 de 5 hoje, semana de 28/09' })
    expect(link).toHaveAttribute('href', '/')
    expect(screen.getByText('3 de 5 hoje')).toBeInTheDocument()
    expect(screen.getByText('3/5')).toBeInTheDocument()
    expect(screen.getByText(/semana de 28\/09/)).toBeInTheDocument()
  })

  it('says there is nothing today when the day is empty', () => {
    render(<DaySummary completed={0} total={0} weekStart={weekStart} />)

    expect(screen.getByRole('link', { name: 'Nenhuma tarefa hoje, semana de 28/09' })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma tarefa hoje')).toBeInTheDocument()
    expect(screen.queryByTestId('summary-ring')).not.toBeInTheDocument()
  })

  it('glows the ring when every task is done', () => {
    render(<DaySummary completed={2} total={2} weekStart={weekStart} />)
    expect(screen.getByTestId('summary-ring')).toHaveAttribute('data-complete', 'true')
  })

  it('clamps the ring progress when completed exceeds total', () => {
    const { container } = render(<DaySummary completed={3} total={2} weekStart={weekStart} />)
    const ring = screen.getByTestId('summary-ring')
    expect(ring).toHaveAttribute('data-complete', 'true')
    const progressCircle = container.querySelectorAll('circle')[1]
    expect(progressCircle).toHaveAttribute('stroke-dashoffset', '0')
  })
})
