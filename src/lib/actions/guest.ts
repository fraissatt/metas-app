'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { cleanupGuests } from '@/lib/guest/cleanup'
import { seedDemoData } from '@/lib/guest/seed'

export async function enterAsGuest(): Promise<void> {
  try {
    await cleanupGuests()
  } catch (error) {
    // Cleanup is housekeeping: the next guest retries it.
    console.error('Guest cleanup failed', error)
  }

  const result = await auth.api.signInAnonymous({ headers: await headers() })
  if (!result?.user) throw new Error('Não foi possível concluir. Tente de novo.')

  await seedDemoData(result.user.id)
  redirect('/')
}
