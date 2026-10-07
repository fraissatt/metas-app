import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MissingGoalsCard } from '@/components/missing-goals-card'
import { parseDay } from '@/lib/dates'

const preview = {
  sourceWeekStart: parseDay('2026-08-10'), // Monday 10/08
  goals: [
    { id: 'goal-a', title: 'Revisar orçamento', taskCount: 4 },
    { id: 'goal-b', title: 'Praticar inglês', taskCount: 1 },
  ],
}

describe('MissingGoalsCard', () => {
  it('lists each missing goal with its task count', () => {
    render(<MissingGoalsCard preview={preview} onRepeat={vi.fn()} />)

    expect(screen.getByText('Revisar orçamento')).toBeInTheDocument()
    expect(screen.getByText('4 tarefas')).toBeInTheDocument()
    expect(screen.getByText('Praticar inglês')).toBeInTheDocument()
    expect(screen.getByText('1 tarefa')).toBeInTheDocument()
  })

  it('names the week the goals came from', () => {
    render(<MissingGoalsCard preview={preview} onRepeat={vi.fn()} />)

    expect(screen.getByText(/semana de 10\/08/i)).toBeInTheDocument()
  })

  it('calls onRepeat once when the button is clicked', async () => {
    const onRepeat = vi.fn().mockResolvedValue(undefined)
    render(<MissingGoalsCard preview={preview} onRepeat={onRepeat} />)

    await userEvent.click(screen.getByRole('button', { name: /trazer/i }))

    expect(onRepeat).toHaveBeenCalledTimes(1)
  })

  it('disables the button while onRepeat is pending', async () => {
    let resolve: () => void = () => {}
    const onRepeat = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r
        }),
    )
    render(<MissingGoalsCard preview={preview} onRepeat={onRepeat} />)

    await userEvent.click(screen.getByRole('button', { name: /trazer/i }))

    const button = screen.getByRole('button', { name: /trazendo/i })
    expect(button).toBeDisabled()

    resolve()
    await screen.findByRole('button', { name: /trazer para esta semana/i })
  })
})
