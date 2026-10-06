'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export async function signOut(destination?: unknown): Promise<void> {
  await auth.api.signOut({ headers: await headers() })
  // Only the two known destinations: never redirect to caller-supplied URLs.
  redirect(destination === '/cadastro' ? '/cadastro' : '/entrar')
}

export async function leaveGuestToSignUp(): Promise<void> {
  await signOut('/cadastro')
}
