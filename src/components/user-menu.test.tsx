import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserMenu } from '@/components/user-menu'

function redirectError() {
  return Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/entrar;307;' })
}

describe('UserMenu', () => {
  it('names the user and signs out from the menu', async () => {
    const onSignOut = vi.fn(async () => {})
    render(<UserMenu name="Ana" isAnonymous={false} onSignOut={onSignOut} />)
    await userEvent.click(screen.getByRole('button', { name: 'Conta: Ana' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })
  it('shows "Visitante" for guests', () => {
    render(<UserMenu name="Visitante" isAnonymous onSignOut={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Conta: Visitante' })).toBeInTheDocument()
  })
  it('swallows the redirect rejection of the Server Action', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    const onSignOut = vi.fn(async () => { throw redirectError() })
    render(<UserMenu name="Ana" isAnonymous={false} onSignOut={onSignOut} />)
    await userEvent.click(screen.getByRole('button', { name: 'Conta: Ana' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }))
    await new Promise((r) => setTimeout(r, 20))
    process.off('unhandledRejection', unhandled)
    expect(onSignOut).toHaveBeenCalledOnce()
    expect(unhandled).not.toHaveBeenCalled()
  })
})
