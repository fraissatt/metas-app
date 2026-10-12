import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { AuthForm } from '@/components/auth-form'

export const metadata: Metadata = { title: 'Criar conta' }

export default async function CadastroPage() {
  const user = await getCurrentUser()
  if (user && !user.isAnonymous) redirect('/')

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-4 md:p-8">
      <h1 className="text-2xl font-bold">Criar conta</h1>
      {user?.isAnonymous && (
        <p role="status" className="rounded-md border border-border bg-card p-3 text-sm">
          Seus dados de visitante vão para a nova conta.
        </p>
      )}
      <AuthForm mode="cadastro" />
      <p className="text-sm text-muted-foreground">
        Já tem conta? <Link href="/entrar" className="text-accent-foreground underline-offset-4 hover:underline">Entrar</Link>
      </p>
    </main>
  )
}
