import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserMenu } from '@/components/user-menu'

function redirectError() {
  return Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/entrar;307;' })
}

async function clickSair(label: string) {
  await userEvent.click(screen.getByRole('button', { name: `Conta: ${label}` }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }))
}

describe('UserMenu', () => {
  it('names the user and signs a real account out without asking', async () => {
    const onSignOut = vi.fn(async () => {})
    render(<UserMenu name="Ana" isAnonymous={false} onSignOut={onSignOut} />)
    await clickSair('Ana')
    expect(onSignOut).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows "Visitante" for guests', () => {
    render(<UserMenu name="Visitante" isAnonymous onSignOut={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Conta: Visitante' })).toBeInTheDocument()
  })

  it('asks a guest to confirm, and only signs out after confirming', async () => {
    const onSignOut = vi.fn(async () => {})
    render(<UserMenu name="Visitante" isAnonymous onSignOut={onSignOut} />)
    await clickSair('Visitante')
    expect(onSignOut).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Seus dados de visitante serão perdidos.')
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it('keeps a guest signed in when they cancel', async () => {
    const onSignOut = vi.fn(async () => {})
    render(<UserMenu name="Visitante" isAnonymous onSignOut={onSignOut} />)
    await clickSair('Visitante')
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(onSignOut).not.toHaveBeenCalled()
  })

  it('swallows the redirect rejection of the Server Action', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    const onSignOut = vi.fn(async () => { throw redirectError() })
    render(<UserMenu name="Ana" isAnonymous={false} onSignOut={onSignOut} />)
    await clickSair('Ana')
    await new Promise((r) => setTimeout(r, 20))
    process.off('unhandledRejection', unhandled)
    expect(onSignOut).toHaveBeenCalledOnce()
    expect(unhandled).not.toHaveBeenCalled()
  })
})
