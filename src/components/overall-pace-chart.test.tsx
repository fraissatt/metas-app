import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { OverallPaceInput } from '@/lib/actions/progress'

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }
})

import { OverallPaceChart } from './overall-pace-chart'

const iso = (day: string) => new Date(`${day}T12:00:00Z`).toISOString()

function objective(id: string, title: string, done: boolean): OverallPaceInput[number] {
  return {
    id,
    title,
    startDate: iso('2020-01-01'),
    targetDate: iso('2099-01-01'),
    completedAt: null,
    tasks: [{ date: iso('2020-01-02'), completed: done, completedAt: done ? iso('2020-01-02') : null }],
  }
}

describe('OverallPaceChart', () => {
  it('renders nothing for objectives without planned tasks', () => {
    const { container } = render(
      <OverallPaceChart input={[{ ...objective('a', 'Vazio', false), tasks: [] }]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('names each objective with its done and ideal share, and says how many are on pace', () => {
    render(<OverallPaceChart input={[objective('a', 'Correr 10 km', true), objective('b', 'Ler 4 livros', false)]} />)

    expect(screen.getByRole('heading', { name: 'Ritmo geral' })).toBeInTheDocument()
    const rows = screen.getByTestId('overall-pace-rows')
    expect(rows).toHaveTextContent('Correr 10 km')
    expect(rows).toHaveTextContent('Ler 4 livros')
    expect(rows).toHaveTextContent(/Feito 100% · ideal \d+%/)
    expect(screen.getByTestId('overall-pace-summary')).toHaveTextContent(/de 2 objetivos|abaixo|estão no ritmo/)
  })

  it('offers a period selector once there is enough history', () => {
    render(<OverallPaceChart input={[objective('a', 'Correr', true)]} />)
    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Tudo' })).toHaveAttribute('aria-pressed', 'true')
  })
})
