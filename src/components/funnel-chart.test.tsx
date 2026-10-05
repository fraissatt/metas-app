import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { FunnelChart } from '@/components/funnel-chart'
import type { FunnelStage } from '@/lib/actions/funnel'

const stages: FunnelStage[] = [
  { id: 'area', label: 'Área', sessions: 10, percentOfStart: 100, dropFromPrevious: null },
  { id: 'foco', label: 'Foco', sessions: 8, percentOfStart: 80, dropFromPrevious: 20 },
  { id: 'prazo', label: 'Prazo', sessions: 4, percentOfStart: 40, dropFromPrevious: 50 },
  { id: 'plan', label: 'Plano criado', sessions: 3, percentOfStart: 30, dropFromPrevious: 25 },
]

describe('FunnelChart', () => {
  it('lists every stage in an accessible table', () => {
    render(<FunnelChart stages={stages} biggestDropId="prazo" />)
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(stages.length + 1)
    const foco = within(table).getByRole('row', { name: /Foco/ })
    expect(within(foco).getByText('8')).toBeInTheDocument()
    expect(within(foco).getByText('80%')).toBeInTheDocument()
    expect(within(foco).getByText('−20%')).toBeInTheDocument()
  })

  it('marks the biggest-drop row', () => {
    render(<FunnelChart stages={stages} biggestDropId="prazo" />)
    const prazo = screen.getByRole('row', { name: /Prazo/ })
    expect(prazo).toHaveAttribute('data-biggest-drop', 'true')
    expect(screen.getByRole('row', { name: /Foco/ })).not.toHaveAttribute('data-biggest-drop')
  })

  it('renders the biggest-drop caption', () => {
    render(<FunnelChart stages={stages} biggestDropId="prazo" />)
    expect(screen.getByText('Maior abandono: Prazo (−50%)')).toBeInTheDocument()
  })

  it('has no caption when every stage is empty', () => {
    const empty = stages.map((s) => ({ ...s, sessions: 0, percentOfStart: 0, dropFromPrevious: s.dropFromPrevious === null ? null : 0 }))
    render(<FunnelChart stages={empty} biggestDropId={null} />)
    expect(screen.queryByText(/Maior abandono/)).not.toBeInTheDocument()
  })
})
