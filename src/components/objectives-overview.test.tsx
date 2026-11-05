import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ObjectivesOverview } from '@/components/objectives-overview'

describe('ObjectivesOverview', () => {
  it('shows the three totals in one sentence', () => {
    const { container } = render(<ObjectivesOverview activeCount={4} weeksFulfilled={18} recentRate={62} />)
    expect(container.textContent).toBe('4 ativos · 18 semanas cumpridas · 62% de média em 8 sem.')
  })

  it('uses the singular forms for one', () => {
    const { container } = render(<ObjectivesOverview activeCount={1} weeksFulfilled={1} recentRate={50} />)
    expect(container.textContent).toBe('1 ativo · 1 semana cumprida · 50% de média em 8 sem.')
  })

  it('shows a dash when nothing was planned', () => {
    render(<ObjectivesOverview activeCount={1} weeksFulfilled={0} recentRate={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
