import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompletedObjectiveCard } from '@/components/completed-objective-card'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const base = {
  id: 'o1',
  title: 'Ler 12 livros',
  targetDate: null,
  weeksFulfilled: 3,
  tasksCompleted: 5,
  onDelete: vi.fn(),
}

describe('CompletedObjectiveCard', () => {
  it('shows the completion date and the schedule suffix', () => {
    render(
      <CompletedObjectiveCard
        {...base}
        completedAt={new Date(2026, 8, 10, 12)}
        targetDate={new Date(2026, 8, 24, 12)}
      />,
    )
    expect(screen.getByText('✓ Concluído em 10/09/2026 · 2 semanas antes do previsto')).toBeInTheDocument()
  })

  it('shows only "✓ Concluído" when the completion date is unknown', () => {
    const { container } = render(
      <CompletedObjectiveCard {...base} completedAt={null} targetDate={new Date(2026, 8, 24, 12)} />,
    )
    expect(screen.getByText('✓ Concluído')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/1969|semanas antes|semana antes/)
  })

  it('uses singular forms for one week and one task', () => {
    render(<CompletedObjectiveCard {...base} completedAt={null} weeksFulfilled={1} tasksCompleted={1} />)
    expect(screen.getByText('1 semana cumprida · 1 tarefa')).toBeInTheDocument()
  })

  it('uses plural forms otherwise', () => {
    render(<CompletedObjectiveCard {...base} completedAt={null} />)
    expect(screen.getByText('3 semanas cumpridas · 5 tarefas')).toBeInTheDocument()
  })

  it('renders the title as a heading link and labels the actions menu with it', () => {
    render(<CompletedObjectiveCard {...base} completedAt={null} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Ler 12 livros' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ações de Ler 12 livros' })).toBeInTheDocument()
  })
})
