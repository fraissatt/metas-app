import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mail = vi.hoisted(() => ({ configured: false }))
vi.mock('@/lib/mailer', () => ({ isMailConfigured: () => mail.configured }))
vi.mock('@/lib/auth-client', () => ({ authClient: { requestPasswordReset: vi.fn() } }))

import EsqueciSenhaPage from '@/app/esqueci-senha/page'

describe('/esqueci-senha', () => {
  it('says the recovery is unavailable, with no form, while the e-mail is not configured', () => {
    mail.configured = false
    render(<EsqueciSenhaPage />)
    expect(screen.getByRole('status')).toHaveTextContent('A recuperação de senha está indisponível no momento')
    expect(screen.queryByLabelText('E-mail')).toBeNull()
    expect(screen.getByRole('link', { name: 'Voltar para entrar' })).toHaveAttribute('href', '/entrar')
  })

  it('shows the form once the e-mail is configured', () => {
    mail.configured = true
    render(<EsqueciSenhaPage />)
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar link' })).toBeInTheDocument()
  })
})
