// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { betterAuth } from 'better-auth/minimal'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '@/lib/db'
import { runAfterResponse, sendResetPassword } from '@/lib/auth'
import { RESET_TOKEN_TTL_SECONDS } from '@/lib/password-reset-email'

const sendMailMock = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@/lib/mailer', () => ({ sendMail: sendMailMock }))

// The same reset options the app uses, on an instance of its own.
function instance(send: (data: { user: { name: string; email: string }; url: string; token: string }) => Promise<void>) {
  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    baseURL: 'http://localhost:3000',
    secret: 'test-secret-test-secret-test-secret-0123',
    emailAndPassword: {
      enabled: true,
      sendResetPassword: send,
      resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
      revokeSessionsOnPasswordReset: true,
    },
  })
}

describe('password recovery', () => {
  it('goes from request to a new working password, once, and ends the other sessions', async () => {
    const sent: Array<{ url: string; token: string; email: string }> = []
    const auth = instance(async ({ user, url, token }) => void sent.push({ url, token, email: user.email }))
    await auth.api.signUpEmail({ body: { name: 'Ana', email: 'ana-reset@example.com', password: 'senha-antiga-1' } })
    const old = await auth.api.signInEmail({ body: { email: 'ana-reset@example.com', password: 'senha-antiga-1' } })
    expect(old.token).toBeTruthy()

    await auth.api.requestPasswordReset({ body: { email: 'ana-reset@example.com', redirectTo: '/redefinir-senha' } })
    expect(sent).toHaveLength(1)
    expect(sent[0].url).toContain('/reset-password/')
    expect(sent[0].url).toContain('callbackURL=')

    await auth.api.resetPassword({ body: { newPassword: 'senha-nova-123', token: sent[0].token } })

    await expect(
      auth.api.signInEmail({ body: { email: 'ana-reset@example.com', password: 'senha-antiga-1' } }),
    ).rejects.toThrow()
    const fresh = await auth.api.signInEmail({ body: { email: 'ana-reset@example.com', password: 'senha-nova-123' } })
    expect(fresh.token).toBeTruthy()

    // The link works once.
    await expect(
      auth.api.resetPassword({ body: { newPassword: 'outra-senha-456', token: sent[0].token } }),
    ).rejects.toThrow()
    // And the session that existed before the reset is gone.
    const sessions = await prisma.session.findMany({ where: { token: old.token } })
    expect(sessions).toHaveLength(0)
  })

  it('answers the same for an e-mail without an account, and sends nothing', async () => {
    const send = vi.fn(async () => {})
    const auth = instance(send)
    const known = await auth.api.requestPasswordReset({ body: { email: 'ninguem-reset@example.com' } })
    expect(send).not.toHaveBeenCalled()
    expect(known.status).toBe(true)
  })

  it('rejects a token that was never issued', async () => {
    const auth = instance(async () => {})
    await expect(auth.api.resetPassword({ body: { newPassword: 'senha-nova-123', token: 'nao-existe' } })).rejects.toThrow()
  })
})

describe('sendResetPassword (the app hook)', () => {
  it('mails the reset link to the account', async () => {
    await sendResetPassword({ user: { name: 'Ana', email: 'ana@example.com' }, url: 'https://metas.example/r/abc' })
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ana@example.com', text: expect.stringContaining('https://metas.example/r/abc') }),
    )
  })

  it('never throws when the mail cannot be sent, so the answer stays the same', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    sendMailMock.mockRejectedValueOnce(new Error('smtp down'))
    await expect(
      sendResetPassword({ user: { name: 'Ana', email: 'ana@example.com' }, url: 'https://metas.example/r/abc' }),
    ).resolves.toBeUndefined()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('runAfterResponse', () => {
  it('still runs the work, and swallows its failure, when there is no request to hang it on', async () => {
    const done = vi.fn()
    runAfterResponse(Promise.resolve().then(done))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(done).toHaveBeenCalled()

    expect(() => runAfterResponse(Promise.reject(new Error('x')))).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})
