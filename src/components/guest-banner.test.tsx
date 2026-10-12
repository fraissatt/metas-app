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

  it('goes straight to the sign-up page, without asking or signing out', () => {
    render(<GuestBanner />)
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/cadastro')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
