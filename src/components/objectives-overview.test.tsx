import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ObjectivesOverview } from '@/components/objectives-overview'

describe('ObjectivesOverview', () => {
  it('shows the three totals', () => {
    render(<ObjectivesOverview activeCount={4} weeksFulfilled={18} recentRate={62} />)
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('objetivos ativos')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('semanas cumpridas')).toBeInTheDocument()
    expect(screen.getByText('62%')).toBeInTheDocument()
    expect(screen.getByText('conclusão média (8 sem.)')).toBeInTheDocument()
  })

  it('shows a dash when nothing was planned', () => {
    render(<ObjectivesOverview activeCount={1} weeksFulfilled={0} recentRate={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
