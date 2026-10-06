import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { AuthForm } from '@/components/auth-form'

export const metadata: Metadata = { title: 'Criar conta' }

export default async function CadastroPage() {
  if (await getCurrentUser()) redirect('/')

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-4 md:p-8">
      <h1 className="text-2xl font-bold">Criar conta</h1>
      <AuthForm mode="cadastro" />
      <p className="text-sm text-muted-foreground">
        Já tem conta? <Link href="/entrar" className="text-accent-foreground underline-offset-4 hover:underline">Entrar</Link>
      </p>
    </main>
  )
}
