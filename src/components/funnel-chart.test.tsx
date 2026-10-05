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

const withFlat: FunnelStage[] = [
  { id: 'area', label: 'Área', sessions: 10, percentOfStart: 100, dropFromPrevious: null },
  { id: 'foco', label: 'Foco', sessions: 10, percentOfStart: 100, dropFromPrevious: 0 },
  { id: 'prazo', label: 'Prazo', sessions: 5, percentOfStart: 50, dropFromPrevious: 50 },
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

  it('never shows a zero drop, in the table or in the chart', () => {
    const { container } = render(<FunnelChart stages={withFlat} biggestDropId="prazo" />)
    expect(container.textContent).not.toContain('−0%')
    const foco = screen.getByRole('row', { name: /Foco/ })
    const cells = within(foco).getAllByRole('cell')
    expect(cells[cells.length - 1]).toHaveTextContent('—')
  })

  it('renders the first frame with stage labels, drops under the label and n · p% at the bar end', () => {
    const { container } = render(<FunnelChart stages={stages} biggestDropId="prazo" />)
    const chart = container.querySelector('[aria-hidden="true"]')!
    expect(chart.textContent).toContain('Prazo')
    expect(chart.textContent).toContain('−50%')
    expect(chart.textContent).toContain('4 · 40%')
    // The drop is no longer a column on the bar end.
    const labels = [...chart.querySelectorAll('text')].map((t) => t.textContent)
    expect(labels).not.toContain('4 · 40%−50%')
  })

  it('has no caption when every stage is empty', () => {
    const empty = stages.map((s) => ({ ...s, sessions: 0, percentOfStart: 0, dropFromPrevious: s.dropFromPrevious === null ? null : 0 }))
    render(<FunnelChart stages={empty} biggestDropId={null} />)
    expect(screen.queryByText(/Maior abandono/)).not.toBeInTheDocument()
  })
})
