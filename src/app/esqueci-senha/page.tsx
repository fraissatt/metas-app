import type { Metadata } from 'next'
import Link from 'next/link'
import { ForgotPasswordForm } from '@/components/password-reset-forms'

export const metadata: Metadata = { title: 'Esqueci minha senha' }

export default function EsqueciSenhaPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Esqueci minha senha</h1>
        <p className="text-sm text-muted-foreground">
          Digite o e-mail da sua conta e enviamos um link para criar uma nova senha.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-sm text-muted-foreground">
        Lembrou?{' '}
        <Link href="/entrar" className="text-accent-foreground underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </main>
  )
}
