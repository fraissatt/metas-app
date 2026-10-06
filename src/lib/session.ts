import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSessionCookie } from 'better-auth/cookies'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export type CurrentUser = { id: string; name: string; email: string; isAnonymous: boolean }

const LAST_SEEN_THROTTLE_MS = 3600_000

// cache(): the layout, the header and every data function ask for the user
// in the same request; this keeps it to one session lookup.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const user = session.user as typeof session.user & { isAnonymous?: boolean | null; lastSeenAt?: Date | string | null }
  const isAnonymous = Boolean(user.isAnonymous)

  if (isAnonymous) {
    const lastSeen = user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : 0
    if (Date.now() - lastSeen > LAST_SEEN_THROTTLE_MS) {
      await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })
    }
  }

  return { id: user.id, name: user.name, email: user.email, isAnonymous }
})

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (user) return user
  // A cookie without a valid session means the session was deleted, which
  // for guests means cleanup removed the account.
  const hadCookie = Boolean(getSessionCookie(await headers()))
  redirect(hadCookie ? '/entrar?expirado=1' : '/entrar')
}
