import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddWeeklyGoalCard } from '@/components/add-weekly-goal-card'

describe('AddWeeklyGoalCard', () => {
  it('shows the dashed "+" trigger by default', () => {
    render(<AddWeeklyGoalCard onCreate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /nova meta semanal/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/título/i)).not.toBeInTheDocument()
  })

  it('reveals the weekly goal form when clicked', async () => {
    render(<AddWeeklyGoalCard onCreate={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /nova meta semanal/i }))

    expect(screen.getByLabelText(/título/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/semana de/i)).toBeInTheDocument()
  })

  it('submits through onCreate and collapses back to the trigger', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<AddWeeklyGoalCard onCreate={onCreate} />)
    await userEvent.click(screen.getByRole('button', { name: /nova meta semanal/i }))

    await userEvent.type(screen.getByLabelText(/título/i), 'Cobrir fluxo de metas')
    await userEvent.type(screen.getByLabelText(/semana de/i), '2026-08-03')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    expect(onCreate).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: /nova meta semanal/i })).toBeInTheDocument()
  })

  it('cancels back to the trigger without calling onCreate', async () => {
    const onCreate = vi.fn()
    render(<AddWeeklyGoalCard onCreate={onCreate} />)
    await userEvent.click(screen.getByRole('button', { name: /nova meta semanal/i }))

    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(screen.getByRole('button', { name: /nova meta semanal/i })).toBeInTheDocument()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('opens straight into the form with the title focused when defaultOpen is set', () => {
    render(<AddWeeklyGoalCard onCreate={vi.fn()} defaultOpen />)

    const title = screen.getByLabelText('Título')
    expect(title).toBeInTheDocument()
    expect(title).toHaveFocus()
    expect(screen.queryByRole('button', { name: /nova meta semanal/i })).not.toBeInTheDocument()
  })

  it('does not steal focus when opened by the trigger', async () => {
    render(<AddWeeklyGoalCard onCreate={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /nova meta semanal/i }))

    expect(screen.getByLabelText('Título')).not.toHaveFocus()
  })
})
