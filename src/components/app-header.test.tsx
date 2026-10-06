import { describe, expect, it, vi } from 'vitest'
import { render as rtlRender, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { BackgroundProvider } from '@/components/background-provider'

vi.mock('next/navigation', () => ({ usePathname: () => '/entrar', useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
const getTodaySummary = vi.hoisted(() => vi.fn(async () => ({ completed: 1, total: 3, weekStart: new Date(2026, 9, 5) })))
vi.mock('@/lib/actions/summary', () => ({ getTodaySummary }))
vi.mock('@/lib/actions/search', () => ({ search: vi.fn() }))
vi.mock('@/lib/actions/auth', () => ({ signOut: vi.fn(), leaveGuestToSignUp: vi.fn() }))

const { AppHeader } = await import('@/components/app-header')
const render = (ui: ReactElement) =>
  rtlRender(<BackgroundProvider initial="nenhum" onChange={vi.fn()}>{ui}</BackgroundProvider>)
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

  it('logged in: shows the user menu and no guest banner', async () => {
    render(await AppHeader({ ...base, user: { id: 'u', name: 'Ana', email: 'a@b.com', isAnonymous: false } }))
    expect(screen.getByRole('button', { name: 'Conta: Ana' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('guest: shows the guest banner', async () => {
    render(await AppHeader({ ...base, user: { id: 'g', name: 'Visitante', email: 'g@x.com', isAnonymous: true } }))
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument()
  })
})
