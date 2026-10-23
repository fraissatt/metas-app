import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GuestBanner } from '@/components/guest-banner'

describe('GuestBanner', () => {
  it('explains the 24 h rule and offers to keep the data with an account', () => {
    render(<GuestBanner />)
    expect(
      screen.getByText('Você está como visitante. Os dados somem após 24 h sem uso. Crie uma conta para guardá-los.'),
    ).toBeInTheDocument()
  })

  it('is a rounded strip from md up, aligned with the island', () => {
    render(<GuestBanner />)
    expect(screen.getByRole('status').className).toMatch(/md:rounded-xl/)
    expect(screen.getByRole('status').className).toMatch(/md:max-w-6xl/)
  })

  it('goes straight to the sign-up page, without asking or signing out', () => {
    render(<GuestBanner />)
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/cadastro')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('has a short text for a phone and the full one from md up, so a screen reader hears only one', () => {
    render(<GuestBanner />)

    expect(screen.getByText('Visitante: seus dados somem em 24 h')).toHaveClass('md:hidden')
    expect(
      screen.getByText('Você está como visitante. Os dados somem após 24 h sem uso. Crie uma conta para guardá-los.'),
    ).toHaveClass('hidden', 'md:inline')
    expect(screen.getByRole('link', { name: 'Criar conta' })).toBeInTheDocument()
  })
})
