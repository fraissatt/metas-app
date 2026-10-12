import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { actAs } from '@/test/session-mock'
import CadastroPage from '@/app/cadastro/page'

// The form uses the app router; keep the real redirect().
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const NOTE = 'Seus dados de visitante vão para a nova conta.'
const guest = { id: 'g', name: 'Visitante', email: 'g@x.com', isAnonymous: true }

describe('/cadastro', () => {
  it('shows the sign-up form with the data note to a guest', async () => {
    actAs(guest)
    render(await CadastroPage())
    expect(screen.getByRole('heading', { name: 'Criar conta' })).toBeInTheDocument()
    expect(screen.getByText(NOTE)).toBeInTheDocument()
  })

  it('shows the form without the note when there is no session', async () => {
    actAs(null)
    render(await CadastroPage())
    expect(screen.getByRole('heading', { name: 'Criar conta' })).toBeInTheDocument()
    expect(screen.queryByText(NOTE)).toBeNull()
  })

  it('still sends a real account to Hoje', async () => {
    await expect(CadastroPage()).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_REDIRECT') })
  })
})
