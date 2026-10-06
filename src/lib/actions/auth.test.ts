import { beforeEach, describe, expect, it, vi } from 'vitest'

const redirect = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
const apiSignOut = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth', () => ({ auth: { api: { signOut: apiSignOut } } }))

const { signOut, leaveGuestToSignUp } = await import('@/lib/actions/auth')

beforeEach(() => { redirect.mockClear(); apiSignOut.mockReset().mockResolvedValue({ success: true }) })

describe('signOut', () => {
  it('signs out and goes to /entrar by default', async () => {
    await signOut()
    expect(apiSignOut).toHaveBeenCalledOnce()
    expect(redirect).toHaveBeenCalledWith('/entrar')
  })
  it('goes to /cadastro only when asked exactly', async () => {
    await signOut('/cadastro')
    expect(redirect).toHaveBeenCalledWith('/cadastro')
    await signOut('https://evil.example')
    expect(redirect).toHaveBeenLastCalledWith('/entrar')
  })
})

describe('leaveGuestToSignUp', () => {
  it('signs out and goes to /cadastro', async () => {
    await leaveGuestToSignUp()
    expect(apiSignOut).toHaveBeenCalledOnce()
    expect(redirect).toHaveBeenCalledWith('/cadastro')
  })
})
