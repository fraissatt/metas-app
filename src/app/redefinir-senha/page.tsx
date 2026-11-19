import type { Metadata } from 'next'
import { ResetPasswordForm } from '@/components/password-reset-forms'

export const metadata: Metadata = { title: 'Nova senha' }

// The link in the e-mail lands here with `?token=…`, or with `?error=INVALID_TOKEN`
// when the token is wrong, expired or already used.
export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const { token, error } = await searchParams

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-4 md:p-8">
      <h1 className="text-2xl font-bold">Criar nova senha</h1>
      <ResetPasswordForm token={error ? null : (token ?? null)} />
    </main>
  )
}
