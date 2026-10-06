import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuestBanner } from '@/components/guest-banner'

describe('GuestBanner', () => {
  it('explains the 24 h rule and offers to create an account', async () => {
    const onCreateAccount = vi.fn(async () => {})
    render(<GuestBanner onCreateAccount={onCreateAccount} />)
    expect(screen.getByText('Você está como visitante. Os dados somem após 24 h sem uso.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(onCreateAccount).toHaveBeenCalledOnce()
  })
  it('swallows the redirect rejection of the Server Action', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    const onCreateAccount = vi.fn(async () => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/cadastro;307;' })
    })
    render(<GuestBanner onCreateAccount={onCreateAccount} />)
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    await new Promise((r) => setTimeout(r, 20))
    process.off('unhandledRejection', unhandled)
    expect(unhandled).not.toHaveBeenCalled()
  })
})
