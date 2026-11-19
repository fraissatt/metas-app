import { betterAuth } from 'better-auth/minimal'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { anonymous } from 'better-auth/plugins'
import { prisma } from '@/lib/db'
import { PASSWORD_MIN_LENGTH } from '@/lib/auth-errors'
import { moveGuestDataOnSignUp } from '@/lib/guest/link'
import { sendMail } from '@/lib/mailer'
import { passwordResetEmail, RESET_TOKEN_TTL_SECONDS } from '@/lib/password-reset-email'

// Counters live in the database (table rateLimit): on Vercel every serverless
// instance has its own memory, so an in-memory limit is easy to sidestep.
export const rateLimitOptions = (enabled: boolean) => ({ enabled, storage: 'database' as const })

/**
 * Sends the reset link. A failure to send is logged and swallowed: the endpoint
 * answers the same whether or not the e-mail has an account (and whether or not
 * the message left), so nothing tells an outsider which addresses are registered.
 */
export async function sendResetPassword({ user, url }: { user: { name: string; email: string }; url: string }) {
  try {
    await sendMail(passwordResetEmail({ name: user.name, email: user.email, url }))
  } catch (error) {
    console.error('Falha ao enviar o e-mail de nova senha', error instanceof Error ? error.message : error)
  }
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    autoSignIn: true,
    sendResetPassword,
    resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
    // Whoever had the old password may still be signed in somewhere.
    revokeSessionsOnPasswordReset: true,
  },
  user: {
    additionalFields: {
      // Server-owned: bumped by getCurrentUser for guests, read by cleanup.
      lastSeenAt: { type: 'date', required: false, input: false, defaultValue: () => new Date() },
    },
  },
  rateLimit: rateLimitOptions(process.env.NODE_ENV === 'production'),
  plugins: [
    anonymous({ generateName: () => 'Visitante', onLinkAccount: moveGuestDataOnSignUp }),
    // Must stay last: lets Server Actions set the session cookie.
    nextCookies(),
  ],
})
