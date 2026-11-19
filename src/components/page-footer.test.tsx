import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageFooter } from './page-footer'

describe('PageFooter', () => {
  it('is a footer landmark with the quiz metrics link', () => {
    render(
      <>
        <main />
        <PageFooter />
      </>,
    )
    const footer = screen.getByRole('contentinfo')
    expect(footer.closest('main')).toBeNull()
    expect(screen.getByRole('link', { name: 'Ver métricas do quiz' })).toHaveAttribute('href', '/funil')
  })
})
