import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BackgroundProvider } from '@/components/background-provider'
import { applyTheme } from '@/components/use-theme'
import { UserMenu, type MenuUser } from '@/components/user-menu'

vi.mock('@/components/interactive-background', () => ({
  InteractiveBackground: ({ style }: { style: string }) => <div data-testid="bg" data-style={style} />,
}))

const ana: MenuUser = { name: 'Ana Maria', email: 'ana@example.com', isAnonymous: false }
const guest: MenuUser = { name: 'Visitante', email: 'g@x.com', isAnonymous: true }

function redirectError() {
  return Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/entrar;307;' })
}

function setup({
  user = ana,
  onSignOut = vi.fn(async () => {}),
  onCreateAccount = vi.fn(async () => {}),
  onThemeChange = vi.fn(async () => {}),
  onBackgroundChange = vi.fn(async () => {}),
}: {
  user?: MenuUser | null
  onSignOut?: () => Promise<void>
  onCreateAccount?: () => Promise<void>
  onThemeChange?: (theme: 'dark' | 'light') => Promise<void>
  onBackgroundChange?: (style: 'aurora' | 'pontos' | 'nenhum') => Promise<void>
} = {}) {
  render(
    <BackgroundProvider initial="aurora" onChange={onBackgroundChange}>
      <UserMenu
        user={user}
        theme="dark"
        onThemeChange={onThemeChange}
        onSignOut={onSignOut}
        onCreateAccount={onCreateAccount}
      />
    </BackgroundProvider>,
  )
  return { onSignOut, onCreateAccount, onThemeChange, onBackgroundChange }
}

const open = (name: string) => userEvent.click(screen.getByRole('button', { name }))

async function clickSair(label: string) {
  await open(`Conta: ${label}`)
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }))
}

afterEach(() => applyTheme('dark'))

describe('UserMenu account', () => {
  it('shows the initials as the trigger and the name and e-mail in the menu', async () => {
    setup()
    const trigger = screen.getByRole('button', { name: 'Conta: Ana Maria' })
    expect(trigger).toHaveTextContent('AM')
    await userEvent.click(trigger)
    expect(await screen.findByText('Ana Maria')).toBeInTheDocument()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
  })

  it('signs a real account out without asking', async () => {
    const { onSignOut } = setup()
    await clickSair('Ana Maria')
    expect(onSignOut).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows "Visitante" for guests, without their placeholder e-mail', async () => {
    setup({ user: guest })
    const trigger = screen.getByRole('button', { name: 'Conta: Visitante' })
    expect(trigger).toHaveTextContent('V')
    await userEvent.click(trigger)
    expect(await screen.findByText('Os dados somem após 24 h sem uso.')).toBeInTheDocument()
    expect(screen.queryByText('g@x.com')).toBeNull()
  })

  it('asks a guest to confirm, and only signs out after confirming', async () => {
    const { onSignOut } = setup({ user: guest })
    await clickSair('Visitante')
    expect(onSignOut).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Seus dados de visitante serão perdidos.')
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it('keeps a guest signed in when they cancel', async () => {
    const { onSignOut } = setup({ user: guest })
    await clickSair('Visitante')
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(onSignOut).not.toHaveBeenCalled()
  })

  it('lets a guest create an account, after confirming', async () => {
    const { onCreateAccount } = setup({ user: guest })
    await open('Conta: Visitante')
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Criar conta' }))
    expect(onCreateAccount).not.toHaveBeenCalled()
    expect(await screen.findByRole('dialog')).toHaveTextContent('você vai para o cadastro')
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(onCreateAccount).toHaveBeenCalledOnce()
  })

  it('does not offer "Criar conta" to a real account', async () => {
    setup()
    await open('Conta: Ana Maria')
    await screen.findByRole('menu')
    expect(screen.queryByRole('menuitem', { name: 'Criar conta' })).toBeNull()
  })

  it('swallows the redirect rejection of the Server Action', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    const onSignOut = vi.fn(async () => {
      throw redirectError()
    })
    setup({ onSignOut })
    await clickSair('Ana Maria')
    await new Promise((r) => setTimeout(r, 20))
    process.off('unhandledRejection', unhandled)
    expect(onSignOut).toHaveBeenCalledOnce()
    expect(unhandled).not.toHaveBeenCalled()
  })
})

describe('UserMenu appearance', () => {
  it('lists the themes with the current one checked', async () => {
    setup()
    await open('Conta: Ana Maria')
    expect(await screen.findByRole('menuitemradio', { name: 'Escuro' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('menuitemradio', { name: 'Claro' })).toHaveAttribute('aria-checked', 'false')
  })

  it('repaints at once when a theme is picked, and saves it', async () => {
    const { onThemeChange } = setup()
    await open('Conta: Ana Maria')
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Claro' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    await waitFor(() => expect(onThemeChange).toHaveBeenCalledWith('light'))
  })

  it('lists the backgrounds with the current one checked', async () => {
    setup()
    await open('Conta: Ana Maria')
    expect(await screen.findByRole('menuitemradio', { name: 'Aurora' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('menuitemradio', { name: 'Grade de pontos' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('menuitemradio', { name: 'Nenhum' })).toBeInTheDocument()
  })

  it('applies and saves a background', async () => {
    const { onBackgroundChange } = setup()
    await open('Conta: Ana Maria')
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Grade de pontos' }))
    expect(screen.getByTestId('bg')).toHaveAttribute('data-style', 'pontos')
    await waitFor(() => expect(onBackgroundChange).toHaveBeenCalledWith('pontos'))
  })

  it('without a session, offers only the appearance menu', async () => {
    setup({ user: null })
    expect(screen.queryByRole('button', { name: /conta:/i })).toBeNull()
    await open('Aparência')
    await screen.findByRole('menuitemradio', { name: 'Escuro' })
    expect(screen.getByRole('menuitemradio', { name: 'Nenhum' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Sair' })).toBeNull()
  })

  it('closes on Escape', async () => {
    setup()
    await open('Conta: Ana Maria')
    await screen.findByRole('menu')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })
})
