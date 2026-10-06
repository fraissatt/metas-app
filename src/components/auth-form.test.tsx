import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthForm } from '@/components/auth-form'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

const signInEmail = vi.hoisted(() => vi.fn())
const signUpEmail = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-client', () => ({
  authClient: { signIn: { email: signInEmail }, signUp: { email: signUpEmail } },
}))

beforeEach(() => {
  push.mockClear(); refresh.mockClear(); signInEmail.mockReset(); signUpEmail.mockReset()
})

describe('AuthForm', () => {
  it('signs in and goes home', async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null })
    render(<AuthForm mode="entrar" />)
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'segredo123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(signInEmail).toHaveBeenCalledWith({ email: 'a@b.com', password: 'segredo123' })
    expect(push).toHaveBeenCalledWith('/')
  })

  it('announces wrong credentials', async () => {
    signInEmail.mockResolvedValue({ data: null, error: { status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' } })
    render(<AuthForm mode="entrar" />)
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'errada123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos')
    expect(push).not.toHaveBeenCalled()
  })

  it('signs up with name, e-mail and password and links to /entrar when the e-mail exists', async () => {
    signUpEmail.mockResolvedValue({ data: null, error: { status: 422, code: 'USER_ALREADY_EXISTS' } })
    render(<AuthForm mode="cadastro" />)
    await userEvent.type(screen.getByLabelText('Nome'), 'Ana')
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'segredo123')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(signUpEmail).toHaveBeenCalledWith({ name: 'Ana', email: 'a@b.com', password: 'segredo123' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Esse e-mail já tem conta')
    expect(screen.getByRole('link', { name: /entrar/i })).toHaveAttribute('href', '/entrar')
  })

  it('requires at least 8 characters for the password', () => {
    render(<AuthForm mode="cadastro" />)
    expect(screen.getByLabelText('Senha')).toHaveAttribute('minLength', '8')
  })

  it('toggles password visibility', async () => {
    render(<AuthForm mode="entrar" />)
    const input = screen.getByLabelText('Senha')
    expect(input).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toBeInTheDocument()
  })
})
