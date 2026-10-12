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
})
