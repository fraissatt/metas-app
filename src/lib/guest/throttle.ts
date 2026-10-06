import { prisma } from '@/lib/db'

export const GUEST_THROTTLE_MESSAGE = 'Muitas tentativas. Tente de novo em alguns minutos.'
export const GUEST_IP_LIMIT = 5
export const GUEST_IP_WINDOW_MS = 10 * 60_000
export const GUEST_GLOBAL_LIMIT = 30
export const GUEST_GLOBAL_WINDOW_MS = 60_000

// Better Auth stores the IP it reads from `x-forwarded-for` (its default
// ipAddressHeaders) in session.ipAddress, so this reads the same header.
// Behind Vercel that header carries the client IP.
export function clientIp(headers: Headers): string | null {
  const first = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return first || null
}

// Better Auth's rate limiter only guards its HTTP router, not auth.api calls
// made from a Server Action, so guest creation is throttled here.
export async function isGuestCreationThrottled(ip: string | null, now: Date = new Date()): Promise<boolean> {
  if (ip) {
    const recentFromIp = await prisma.session.count({
      where: {
        ipAddress: ip,
        user: { isAnonymous: true },
        createdAt: { gt: new Date(now.getTime() - GUEST_IP_WINDOW_MS) },
      },
    })
    if (recentFromIp >= GUEST_IP_LIMIT) return true
  }
  const recentGuests = await prisma.user.count({
    where: { isAnonymous: true, createdAt: { gt: new Date(now.getTime() - GUEST_GLOBAL_WINDOW_MS) } },
  })
  return recentGuests >= GUEST_GLOBAL_LIMIT
}
