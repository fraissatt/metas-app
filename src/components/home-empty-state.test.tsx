import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomeEmptyState } from '@/components/home-empty-state'

describe('HomeEmptyState', () => {
  it('sends a user who has an objective but no weekly goal to the objectives list', () => {
    render(<HomeEmptyState variant="no-goal" />)

    expect(screen.getByRole('link', { name: /objetivo/i })).toHaveAttribute('href', '/objectives')
  })

  it('shows the weekly-goal heading', () => {
    render(<HomeEmptyState variant="no-goal" />)
    expect(screen.getByRole('heading')).toHaveTextContent('Defina a primeira meta semanal')
  })
})
