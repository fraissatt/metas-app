import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Breadcrumbs } from '@/components/breadcrumbs'

describe('Breadcrumbs', () => {
  const items = [
    { label: 'Objetivos', href: '/objectives' },
    { label: 'Correr uma maratona', href: '/objectives/1' },
    { label: 'Correr 3 vezes', href: '/objectives/1/weeks/2' },
  ]

  it('links every item except the current page', () => {
    render(<Breadcrumbs items={items} />)

    const nav = screen.getByRole('navigation', { name: 'Trilha' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Objetivos' })).toHaveAttribute('href', '/objectives')
    expect(screen.getByRole('link', { name: 'Correr uma maratona' })).toHaveAttribute('href', '/objectives/1')
    expect(screen.queryByRole('link', { name: 'Correr 3 vezes' })).not.toBeInTheDocument()
    expect(screen.getByText('Correr 3 vezes')).toHaveAttribute('aria-current', 'page')
  })

  it('keeps the full name available when a label is truncated', () => {
    render(<Breadcrumbs items={items} />)
    const current = screen.getByText('Correr 3 vezes')
    expect(current).toHaveAttribute('title', 'Correr 3 vezes')
    expect(current).toHaveClass('truncate')
  })
})
