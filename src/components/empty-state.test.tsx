import Link from 'next/link'
import { render, screen } from '@testing-library/react'
import { Target } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('says what is missing, why, and offers the next step', () => {
    render(
      <EmptyState icon={Target} title="Comece pelo primeiro objetivo" action={<Link href="/objectives/new">Criar</Link>}>
        Um objetivo é o destino.
      </EmptyState>,
    )
    expect(screen.getByText('Comece pelo primeiro objetivo')).toBeInTheDocument()
    expect(screen.getByText('Um objetivo é o destino.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Criar' })).toHaveAttribute('href', '/objectives/new')
  })

  it('keeps the icon decorative and works without text or action', () => {
    const { container } = render(<EmptyState icon={Target} title="Nada aqui ainda" compact />)
    expect(container.querySelector('svg')?.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(container.querySelectorAll('p')).toHaveLength(1)
  })
})
