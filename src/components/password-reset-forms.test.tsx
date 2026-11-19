import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const requestPasswordReset = vi.hoisted(() => vi.fn())
const resetPassword = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-client', () => ({ authClient: { requestPasswordReset, resetPassword } }))

import { ForgotPasswordForm, ResetPasswordForm } from './password-reset-forms'

beforeEach(() => {
  requestPasswordReset.mockReset()
  resetPassword.mockReset()
})

describe('ForgotPasswordForm', () => {
  it('asks for the reset with a redirect to the new-password page, then says the same thing for every e-mail', async () => {
    requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null })
    render(<ForgotPasswordForm />)

    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(requestPasswordReset).toHaveBeenCalledWith({ email: 'ana@example.com', redirectTo: '/redefinir-senha' })
    expect(await screen.findByRole('status')).toHaveTextContent('Se esse e-mail tem uma conta, enviamos um link')
  })

  it('shows the rate limit message and lets the person try again', async () => {
    requestPasswordReset.mockResolvedValue({ data: null, error: { status: 429 } })
    render(<ForgotPasswordForm />)

    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas')
    expect(screen.getByRole('button', { name: 'Enviar link' })).toBeEnabled()
  })
})

describe('ResetPasswordForm', () => {
  it('without a token says the link is no longer valid and offers a new one', () => {
    render(<ResetPasswordForm token={null} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Esse link não vale mais')
    expect(screen.getByRole('link', { name: 'Peça um novo' })).toHaveAttribute('href', '/esqueci-senha')
  })

  it('saves the new password with the token and sends the person to sign in', async () => {
    resetPassword.mockResolvedValue({ data: { status: true }, error: null })
    render(<ResetPasswordForm token="tok-123" />)

    await userEvent.type(screen.getByLabelText('Nova senha'), 'senha-nova-123')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(resetPassword).toHaveBeenCalledWith({ newPassword: 'senha-nova-123', token: 'tok-123' })
    expect(await screen.findByText('Senha alterada. Entre com a nova senha.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para entrar' })).toHaveAttribute('href', '/entrar')
  })

  it('names an expired link and offers a new one', async () => {
    resetPassword.mockResolvedValue({ data: null, error: { status: 400, code: 'INVALID_TOKEN' } })
    render(<ResetPasswordForm token="velho" />)

    await userEvent.type(screen.getByLabelText('Nova senha'), 'senha-nova-123')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Esse link não vale mais. Peça um novo.')
    await waitFor(() => expect(screen.getByRole('link', { name: 'Pedir um novo link' })).toHaveAttribute('href', '/esqueci-senha'))
  })

  it('can show and hide the password', async () => {
    render(<ResetPasswordForm token="tok" />)
    const field = screen.getByLabelText('Nova senha')
    expect(field).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(field).toHaveAttribute('type', 'text')
  })
})
