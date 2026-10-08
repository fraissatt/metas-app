import { betterAuth } from 'better-auth/minimal'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { anonymous } from 'better-auth/plugins'
import { prisma } from '@/lib/db'
import { PASSWORD_MIN_LENGTH } from '@/lib/auth-errors'

// Counters live in the database (table rateLimit): on Vercel every serverless
// instance has its own memory, so an in-memory limit is easy to sidestep.
export const rateLimitOptions = (enabled: boolean) => ({ enabled, storage: 'database' as const })

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      // Server-owned: bumped by getCurrentUser for guests, read by cleanup.
      lastSeenAt: { type: 'date', required: false, input: false, defaultValue: () => new Date() },
    },
  },
  rateLimit: rateLimitOptions(process.env.NODE_ENV === 'production'),
  plugins: [
    anonymous({ generateName: () => 'Visitante' }),
    // Must stay last: lets Server Actions set the session cookie.
    nextCookies(),
  ],
})
