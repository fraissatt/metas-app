import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ObjectivePaceChart } from '@/components/objective-pace-chart'
import type { ObjectivePaceInput } from '@/lib/actions/progress'

// "Today" is Wednesday 2026-08-12, Brasília. Only Date is faked so user-event
// and recharts keep their timers.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-08-12T12:00:00-03:00'))
})
afterEach(() => vi.useRealTimers())

const day = (key: string) => new Date(`${key}T00:00:00-03:00`).toISOString()
const planned = (date: string) => ({ date: day(date), completed: false, completedAt: null })
const done = (date: string, at: string) => ({ date: day(date), completed: true, completedAt: `${at}:00-03:00` })

const input = (overrides: Partial<ObjectivePaceInput>): ObjectivePaceInput => ({
  tasks: [planned('2026-08-03'), planned('2026-08-10'), planned('2026-08-17'), planned('2026-08-24')],
  startDate: day('2026-08-03'),
  targetDate: day('2026-08-30'),
  completedAt: null,
  ...overrides,
})

describe('ObjectivePaceChart', () => {
  it('shows the empty state when there are no tasks', () => {
    render(<ObjectivePaceChart input={input({ tasks: [] })} />)

    expect(screen.getByText('Sem tarefas planejadas ainda para gerar o gráfico.')).toBeInTheDocument()
  })

  it("offers only the periods that fit the objective's span", () => {
    // 2026-08-03 → 2026-09-11 is 40 days.
    const { unmount } = render(<ObjectivePaceChart input={input({ targetDate: day('2026-09-11') })} />)
    expect(screen.getByRole('button', { name: '30 dias' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prazo todo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '60 dias' })).not.toBeInTheDocument()
    unmount()

    // 100 days.
    render(<ObjectivePaceChart input={input({ targetDate: day('2026-11-10') })} />)
    expect(screen.getByRole('button', { name: '60 dias' })).toBeInTheDocument()
  })

  it('switching the period keeps the selected button pressed', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ObjectivePaceChart input={input({ targetDate: day('2026-09-11') })} />)

    expect(screen.getByRole('button', { name: 'Prazo todo' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: '30 dias' }))

    expect(screen.getByRole('button', { name: '30 dias' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Prazo todo' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('when behind, says how many points are missing and never shows a minus sign', () => {
    render(<ObjectivePaceChart input={input({})} />)

    const summary = screen.getByTestId('pace-summary')
    expect(summary).toHaveTextContent(/Faltam \d+ pontos? para o ritmo ideal/)
    expect(summary.textContent).not.toMatch(/[−-]\s?\d/)
  })

  it('when ahead or level, says so', () => {
    render(
      <ObjectivePaceChart
        input={input({
          tasks: [done('2026-08-03', '2026-08-03T10:00'), done('2026-08-24', '2026-08-04T10:00')],
        })}
      />,
    )

    expect(screen.getByTestId('pace-summary')).toHaveTextContent('Você está no ritmo ou à frente.')
    expect(screen.getByTestId('pace-summary')).not.toHaveTextContent('Faltam')
  })

  it('lists the three lines in the legend', () => {
    render(<ObjectivePaceChart input={input({})} />)

    const legend = screen.getByTestId('pace-legend')
    expect(within(legend).getByText('Seu progresso')).toBeInTheDocument()
    expect(within(legend).getByText('Projeção no ritmo atual')).toBeInTheDocument()
    expect(within(legend).getByText(/Ideal/)).toBeInTheDocument()
  })

  it('offers the same numbers as a table', () => {
    render(<ObjectivePaceChart input={input({})} />)

    const table = screen.getByRole('table', { hidden: true })
    expect(within(table).getAllByRole('row', { hidden: true }).length).toBeGreaterThan(1)
  })

  it('a completed objective shows no projection', () => {
    render(
      <ObjectivePaceChart
        input={input({
          completedAt: '2026-08-12T10:00:00-03:00',
          tasks: [done('2026-08-03', '2026-08-05T10:00'), done('2026-08-10', '2026-08-12T09:00')],
        })}
      />,
    )

    expect(screen.queryByText('Projeção no ritmo atual')).not.toBeInTheDocument()
    expect(screen.getByTestId('pace-summary')).toHaveTextContent('Objetivo concluído')
  })

  it('on the first day there is no projection to show', () => {
    vi.setSystemTime(new Date('2026-08-03T09:00:00-03:00'))
    render(<ObjectivePaceChart input={input({})} />)

    expect(screen.queryByText('Projeção no ritmo atual')).not.toBeInTheDocument()
    expect(screen.getByTestId('pace-summary')).not.toHaveTextContent('projeção no fim')
  })
})
