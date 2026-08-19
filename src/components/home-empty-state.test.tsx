import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomeEmptyState } from '@/components/home-empty-state'

describe('HomeEmptyState', () => {
  it('sends a brand-new user to the objective form', () => {
    render(<HomeEmptyState variant="no-objective" />)

    expect(screen.getByRole('link', { name: /primeiro objetivo/i })).toHaveAttribute(
      'href',
      '/objectives/new',
    )
  })

  it('sends a user who has an objective but no weekly goal to the objectives list', () => {
    render(<HomeEmptyState variant="no-goal" />)

    expect(screen.getByRole('link', { name: /objetivo/i })).toHaveAttribute('href', '/objectives')
  })

  it('gives each variant its own heading, so the two are not interchangeable', () => {
    const { unmount } = render(<HomeEmptyState variant="no-objective" />)
    expect(screen.getByRole('heading')).toHaveTextContent('Comece pelo primeiro objetivo')
    unmount()

    render(<HomeEmptyState variant="no-goal" />)
    expect(screen.getByRole('heading')).toHaveTextContent('Defina a primeira meta semanal')
  })
})
