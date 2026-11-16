import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PendingButton } from './pending-button'

describe('PendingButton', () => {
  it('shows its icon and accepts clicks while idle', () => {
    render(
      <PendingButton pending={false} icon={<svg data-testid="icon" />}>
        Salvar
      </PendingButton>,
    )
    const button = screen.getByRole('button', { name: 'Salvar' })
    expect(button).toBeEnabled()
    expect(button).not.toHaveAttribute('aria-busy')
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
  })

  it('swaps the icon for a spinner and blocks a second click while pending', () => {
    render(
      <PendingButton pending icon={<svg data-testid="icon" />}>
        Salvar
      </PendingButton>,
    )
    const button = screen.getByRole('button', { name: 'Salvar' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByTestId('spinner')).toBeInTheDocument()
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument()
  })
})
