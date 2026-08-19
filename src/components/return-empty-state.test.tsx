import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReturnEmptyState } from '@/components/return-empty-state'

const preview = {
  sourceWeekStart: new Date(2026, 7, 10),
  goals: [{ id: 'goal-a', title: 'Revisar orçamento', taskCount: 4 }],
}

describe('ReturnEmptyState', () => {
  it('frames the card with the empty-week line', () => {
    render(<ReturnEmptyState preview={preview} onRepeat={vi.fn()} />)

    expect(screen.getByText('Sua semana ainda está vazia.')).toBeInTheDocument()
  })

  it('renders the offer itself', () => {
    render(<ReturnEmptyState preview={preview} onRepeat={vi.fn()} />)

    expect(screen.getByText('Revisar orçamento')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /trazer/i })).toBeInTheDocument()
  })

  it('offers building the week from scratch instead', () => {
    render(<ReturnEmptyState preview={preview} onRepeat={vi.fn()} />)

    expect(screen.getByRole('link', { name: /nova meta semanal/i })).toHaveAttribute(
      'href',
      '/objectives',
    )
  })
})
