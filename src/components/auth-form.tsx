'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { authErrorMessage, PASSWORD_MIN_LENGTH } from '@/lib/auth-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AuthForm({ mode }: { mode: 'entrar' | 'cadastro' }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const signingUp = mode === 'cadastro'

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    setPending(true)
    setError(null)
    try {
      const result = signingUp
        ? await authClient.signUp.email({ name: String(form.get('name') ?? '').trim(), email, password })
        : await authClient.signIn.email({ email, password })
      if (result.error) {
        setError(authErrorMessage(result.error))
        setPending(false)
        return
      }
      // Stay pending on success: the page is navigating away, and re-enabling
      // the button would allow a double submit.
      router.push('/')
      router.refresh()
    } catch {
      setError(authErrorMessage(null))
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {signingUp && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            minLength={PASSWORD_MIN_LENGTH}
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {signingUp && <p className="text-xs text-muted-foreground">Mínimo de {PASSWORD_MIN_LENGTH} caracteres.</p>}
      </div>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
            {error === 'Esse e-mail já tem conta' && (
              <> <Link href="/entrar" className="underline underline-offset-4">Entrar</Link></>
            )}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending}>
        {signingUp ? 'Criar conta' : 'Entrar'}
      </Button>
    </form>
  )
}
