import { describe, expect, it, vi } from 'vitest'
import { render as rtlRender, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { BackgroundProvider } from '@/components/background-provider'
import { TourProvider } from '@/components/tour-provider'

vi.mock('next/navigation', () => ({ usePathname: () => '/entrar', useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
const getTodaySummary = vi.hoisted(() => vi.fn(async () => ({ completed: 1, total: 3, weekStart: new Date(2026, 9, 5) })))
vi.mock('@/lib/actions/summary', () => ({ getTodaySummary }))
vi.mock('@/lib/actions/search', () => ({ search: vi.fn() }))
vi.mock('@/lib/actions/auth', () => ({ signOut: vi.fn(), leaveGuestToSignUp: vi.fn() }))

const { AppHeader, HIDE_UNLESS, HIDE_WHEN } = await import('@/components/app-header')
const render = (ui: ReactElement) =>
  rtlRender(
    <BackgroundProvider initial="nenhum" onChange={vi.fn()}>
      <TourProvider initialSeen canOpen={false} onSeen={vi.fn(async () => {})}>
        {ui}
      </TourProvider>
    </BackgroundProvider>,
  )
const base = { theme: 'dark' as const, onThemeChange: vi.fn() }

describe('AppHeader', () => {
  it('logged out: no summary, search, nav or user menu, and no summary query', async () => {
    getTodaySummary.mockClear()
    render(await AppHeader({ ...base, user: null }))
    expect(getTodaySummary).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /buscar/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /conta:/i })).toBeNull()
    expect(screen.getByRole('link', { name: 'Metas' })).toBeInTheDocument()
  })

  it('logged out: still offers the appearance menu, and no separate theme or background buttons', async () => {
    render(await AppHeader({ ...base, user: null }))
    expect(screen.getByRole('button', { name: 'Aparência' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /tema/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /fundo/i })).toBeNull()
  })

  it('logged in: shows the user menu and no guest banner', async () => {
    render(await AppHeader({ ...base, user: { id: 'u', name: 'Ana', email: 'a@b.com', isAnonymous: false } }))
    expect(screen.getByRole('button', { name: 'Conta: Ana' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows the help button to people with a session, and not to visitors without one', async () => {
    render(await AppHeader({ ...base, user: { id: 'u', name: 'Ana', email: 'a@b.com', isAnonymous: false } }))
    expect(screen.getByRole('button', { name: 'Ver tour' })).toBeInTheDocument()
  })

  it('logged out: no help button', async () => {
    render(await AppHeader({ ...base, user: null }))
    expect(screen.queryByRole('button', { name: 'Ver tour' })).toBeNull()
  })

  it('guest: shows the guest banner', async () => {
    render(await AppHeader({ ...base, user: { id: 'g', name: 'Visitante', email: 'g@x.com', isAnonymous: true } }))
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/cadastro')
  })

  it('puts the bar in a top island from md up, hidden only where that applies', async () => {
    render(await AppHeader({ ...base, user: { id: 'u', name: 'Ana', email: 'a@b.com', isAnonymous: false } }))
    const island = screen.getByRole('banner').querySelector('[data-edge="top"]') as HTMLElement
    expect(island).not.toBeNull()
    expect(island.className).toMatch(/md:island/)
    expect(island.className).toMatch(/md:fixed/)
    // Below md the plain bar must stick: a sticky element only travels inside its parent, so the
    // stickiness belongs on the header (as tall as the page), not on the bar inside it.
    expect(screen.getByRole('banner').className).toMatch(/(^|\s)sticky(\s|$)/)
    expect(screen.getByRole('banner').className).toMatch(/md:static/)
    expect(island.className).not.toMatch(/(^|\s)sticky(\s|$)/)
  })

  it('keeps a spacer where the fixed island used to take room, from md up', async () => {
    render(await AppHeader({ ...base, user: null }))
    const spacer = screen.getByRole('banner').nextElementSibling as HTMLElement
    expect(spacer).toHaveAttribute('aria-hidden', 'true')
    expect(spacer.className).toMatch(/hidden/)
    expect(spacer.className).toMatch(/md:block/)
  })

  it('guest: the notice is outside the bar, in flow below it', async () => {
    render(await AppHeader({ ...base, user: { id: 'g', name: 'Visitante', email: 'g@x.com', isAnonymous: true } }))
    expect(within(screen.getByRole('banner')).queryByRole('status')).toBeNull()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('marks the bar, its content and the spacer so the installed app can move them into the title bar', async () => {
    const { container } = render(await AppHeader({ ...base, user: null }))

    expect(container.querySelector('header [data-app-bar]')).not.toBeNull()
    expect(container.querySelector('[data-app-bar] [data-app-bar-inner]')).not.toBeNull()
    expect(container.querySelector('[data-app-bar-spacer]')).toHaveAttribute('aria-hidden', 'true')
  })

  it('never hides the bar on scroll inside the installed app title bar, and keeps hiding it elsewhere', () => {
    // `when` is a plain query: a browser that does not know window-controls-overlay
    // must still hide the bar on desktop, so the feature lives only in `unless`.
    expect(HIDE_WHEN).toBe('(min-width: 768px)')
    expect(HIDE_UNLESS).toBe('(display-mode: window-controls-overlay)')
  })
})
