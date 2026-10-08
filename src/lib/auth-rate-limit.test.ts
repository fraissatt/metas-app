// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { betterAuth } from 'better-auth/minimal'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '@/lib/db'
import { rateLimitOptions } from '@/lib/auth'

// Two separate auth instances stand for two serverless instances, each with
// its own memory. They only share the database.
const instance = () =>
  betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    baseURL: 'http://localhost:3000',
    secret: 'test-secret-test-secret-test-secret-0123',
    emailAndPassword: { enabled: true },
    rateLimit: rateLimitOptions(true),
  })

const signIn = (auth: ReturnType<typeof instance>, ip = '203.0.113.7') =>
  auth.handler(
    new Request('http://localhost:3000/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, origin: 'http://localhost:3000' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong-password' }),
    }),
  )

describe('login rate limit', () => {
  it('counts attempts in the database, so separate instances share the limit', async () => {
    const a = instance()
    const b = instance()
    const statuses: number[] = []
    for (const auth of [a, b, a, b, a, b]) statuses.push((await signIn(auth)).status)

    expect(statuses.slice(0, 3)).not.toContain(429)
    expect(statuses).toContain(429)
    expect(await prisma.rateLimit.count()).toBeGreaterThan(0)
  })

  it('limits each IP on its own', async () => {
    const auth = instance()
    for (let i = 0; i < 5; i++) await signIn(auth, '203.0.113.7')

    expect((await signIn(auth, '203.0.113.7')).status).toBe(429)
    expect((await signIn(auth, '198.51.100.9')).status).not.toBe(429)
  })
})
