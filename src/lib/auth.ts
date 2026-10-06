import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { anonymous } from 'better-auth/plugins'
import { prisma } from '@/lib/db'

export const PASSWORD_MIN_LENGTH = 8

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
  rateLimit: { enabled: process.env.NODE_ENV === 'production' },
  plugins: [
    anonymous({ generateName: () => 'Visitante' }),
    // Must stay last: lets Server Actions set the session cookie.
    nextCookies(),
  ],
})
