import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { actAs } from '@/test/session-mock'

vi.mock('@/lib/actions/guest', () => ({ enterAsGuest: vi.fn() }))
// The form uses the app router; keep the real redirect().
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import EntrarPage from '@/app/entrar/page'

const mail = vi.hoisted(() => ({ configured: false }))
vi.mock('@/lib/mailer', () => ({ isMailConfigured: () => mail.configured }))

const NOTE = 'Entrar numa conta existente descarta os dados de visitante.'
const guest = { id: 'g', name: 'Visitante', email: 'g@x.com', isAnonymous: true }
const props = { searchParams: Promise.resolve({}) }

describe('/entrar', () => {
  it('shows the form and the discard note to a guest, without offering guest sign-in again', async () => {
    actAs(guest)
    render(await EntrarPage(props))
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByText(NOTE)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Entrar como visitante' })).toBeNull()
  })

  it('offers guest sign-in and no note when there is no session', async () => {
    actAs(null)
    render(await EntrarPage(props))
    expect(screen.getByRole('button', { name: 'Entrar como visitante' })).toBeInTheDocument()
    expect(screen.queryByText(NOTE)).toBeNull()
  })

  it('still sends a real account to Hoje', async () => {
    await expect(EntrarPage(props)).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_REDIRECT') })
  })

  it('offers "Esqueci minha senha" only once the e-mail is configured', async () => {
    actAs(null)
    mail.configured = false
    const off = render(await EntrarPage(props))
    expect(screen.queryByRole('link', { name: 'Esqueci minha senha' })).toBeNull()
    off.unmount()

    mail.configured = true
    render(await EntrarPage(props))
    expect(screen.getByRole('link', { name: 'Esqueci minha senha' })).toHaveAttribute('href', '/esqueci-senha')
    mail.configured = false
  })
})
