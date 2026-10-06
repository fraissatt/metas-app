import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuestBanner } from '@/components/guest-banner'

describe('GuestBanner', () => {
  it('explains the 24 h rule and asks before leaving to create an account', async () => {
    const onCreateAccount = vi.fn(async () => {})
    render(<GuestBanner onCreateAccount={onCreateAccount} />)
    expect(screen.getByText('Você está como visitante. Os dados somem após 24 h sem uso.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(onCreateAccount).not.toHaveBeenCalled()
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Seus dados de visitante serão perdidos e você vai para o cadastro.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(onCreateAccount).toHaveBeenCalledOnce()
  })

  it('stays put when the guest cancels', async () => {
    const onCreateAccount = vi.fn(async () => {})
    render(<GuestBanner onCreateAccount={onCreateAccount} />)
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(onCreateAccount).not.toHaveBeenCalled()
  })

  it('swallows the redirect rejection of the Server Action', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    const onCreateAccount = vi.fn(async () => {
      throw Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/cadastro;307;' })
    })
    render(<GuestBanner onCreateAccount={onCreateAccount} />)
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Continuar' }))
    await new Promise((r) => setTimeout(r, 20))
    process.off('unhandledRejection', unhandled)
    expect(onCreateAccount).toHaveBeenCalledOnce()
    expect(unhandled).not.toHaveBeenCalled()
  })
})
