'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { cleanupGuests } from '@/lib/guest/cleanup'
import { seedDemoData } from '@/lib/guest/seed'
import { clientIp, isGuestCreationThrottled } from '@/lib/guest/throttle'

// Returns { throttled: true } instead of throwing: Next hides the message of an
// error thrown from a Server Action in production, so the button could not tell
// "too many attempts" apart from a real failure. A successful entry redirects.
export async function enterAsGuest(): Promise<{ throttled: true } | undefined> {
  const requestHeaders = await headers()
  if (await isGuestCreationThrottled(clientIp(requestHeaders))) return { throttled: true }

  try {
    await cleanupGuests()
  } catch (error) {
    // Cleanup is housekeeping: the next guest retries it.
    console.error('Guest cleanup failed', error)
  }

  const result = await auth.api.signInAnonymous({ headers: requestHeaders })
  if (!result?.user) throw new Error('Não foi possível concluir. Tente de novo.')

  try {
    await seedDemoData(result.user.id)
  } catch (error) {
    // Don't leave a signed-in guest without data: drop the user (sessions and
    // accounts cascade). A stale cookie then sends them to /entrar?expirado=1.
    console.error('Guest seeding failed', error)
    await prisma.user.delete({ where: { id: result.user.id } }).catch((deleteError) => console.error('Orphan guest cleanup failed', deleteError))
    throw new Error('Não foi possível concluir. Tente de novo.')
  }
  redirect('/')
}
