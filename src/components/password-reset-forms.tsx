'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { authErrorMessage, PASSWORD_MIN_LENGTH } from '@/lib/auth-errors'
import { PendingButton } from '@/components/pending-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SAME_ANSWER =
  'Se esse e-mail tem uma conta, enviamos um link para criar uma nova senha. Confira a caixa de entrada e o spam.'

/** Asks for the e-mail. The answer is the same whether or not the account exists. */
export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim()
    setPending(true)
    setError(null)
    try {
      const result = await authClient.requestPasswordReset({ email, redirectTo: '/redefinir-senha' })
      // Rate limiting and server failures are shown; an unknown e-mail never is.
      if (result.error) {
        setError(authErrorMessage(result.error))
        setPending(false)
        return
      }
      setSent(true)
    } catch {
      setError(authErrorMessage(null))
    }
    setPending(false)
  }

  if (sent) {
    return (
      <p role="status" className="rounded-md border border-border bg-card p-3 text-sm">
        {SAME_ANSWER}
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <PendingButton type="submit" pending={pending}>
        Enviar link
      </PendingButton>
    </form>
  )
}

/** Chooses the new password with the token from the e-mailed link. */
export function ResetPasswordForm({ token }: { token: string | null }) {
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  if (!token) {
    return (
      <p role="alert" className="rounded-md border border-border bg-card p-3 text-sm">
        Esse link não vale mais. <Link href="/esqueci-senha" className="underline underline-offset-4">Peça um novo</Link>.
      </p>
    )
  }

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 text-sm">
        <p>Senha alterada. Entre com a nova senha.</p>
        <Link href="/entrar" className="self-start font-medium text-accent-foreground underline-offset-4 hover:underline">
          Ir para entrar
        </Link>
      </div>
    )
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const newPassword = String(new FormData(event.currentTarget).get('password') ?? '')
    setPending(true)
    setError(null)
    try {
      const result = await authClient.resetPassword({ newPassword, token: token ?? undefined })
      if (result.error) {
        setError(authErrorMessage(result.error))
        setPending(false)
        return
      }
      setDone(true)
    } catch {
      setError(authErrorMessage(null))
    }
    setPending(false)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Nova senha</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute inset-y-0 right-0 flex items-center rounded-md px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Mínimo de {PASSWORD_MIN_LENGTH} caracteres.</p>
      </div>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}{' '}
            <Link href="/esqueci-senha" className="underline underline-offset-4">
              Pedir um novo link
            </Link>
          </p>
        )}
      </div>
      <PendingButton type="submit" pending={pending}>
        Salvar nova senha
      </PendingButton>
    </form>
  )
}
