import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { AuthForm } from '@/components/auth-form'

export const metadata: Metadata = { title: 'Entrar' }

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ expirado?: string }> }) {
  if (await getCurrentUser()) redirect('/')
  const { expirado } = await searchParams

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-4 md:p-8">
      <h1 className="text-2xl font-bold">Entrar</h1>
      {expirado === '1' && (
        <p role="status" className="rounded-md border border-border bg-card p-3 text-sm">
          Sua sessão de visitante expirou
        </p>
      )}
      <AuthForm mode="entrar" />
      <p className="text-sm text-muted-foreground">
        Não tem conta? <Link href="/cadastro" className="text-accent-foreground underline-offset-4 hover:underline">Criar conta</Link>
      </p>
      {/* Task 9 adds the guest button here */}
    </main>
  )
}
