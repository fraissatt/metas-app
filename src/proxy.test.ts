// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { config, proxy } from '@/proxy'

const ORIGIN = 'http://localhost:3000'

function request(path: string, cookie?: string) {
  return new NextRequest(`${ORIGIN}${path}`, cookie ? { headers: { cookie } } : undefined)
}

const passesThrough = (response: Response) => response.headers.get('x-middleware-next') === '1'

afterEach(() => vi.unstubAllEnvs())

describe('proxy', () => {
  it('sends a visitor without a session cookie to /entrar', () => {
    for (const path of ['/', '/objectives', '/objectives/abc/weeks/xyz', '/quiz']) {
      const response = proxy(request(path))
      expect(response.status, path).toBe(307)
      expect(response.headers.get('location'), path).toBe(`${ORIGIN}/entrar`)
    }
  })

  it('lets a request with the session cookie through', () => {
    expect(passesThrough(proxy(request('/objectives', 'better-auth.session_token=abc')))).toBe(true)
  })

  it('also accepts the __Secure- cookie used on HTTPS', () => {
    expect(passesThrough(proxy(request('/', '__Secure-better-auth.session_token=abc')))).toBe(true)
  })

  it('ignores other cookies', () => {
    const response = proxy(request('/', 'theme=dark; fundo=aurora'))
    expect(response.status).toBe(307)
  })

  it('keeps /entrar and /cadastro open without a cookie', () => {
    expect(passesThrough(proxy(request('/entrar')))).toBe(true)
    expect(passesThrough(proxy(request('/cadastro')))).toBe(true)
  })

  it('opens /funil without a cookie only while FUNNEL_PUBLIC is "true"', () => {
    vi.stubEnv('FUNNEL_PUBLIC', 'true')
    expect(passesThrough(proxy(request('/funil')))).toBe(true)

    vi.stubEnv('FUNNEL_PUBLIC', 'false')
    expect(proxy(request('/funil')).status).toBe(307)

    vi.stubEnv('FUNNEL_PUBLIC', 'TRUE')
    expect(proxy(request('/funil')).status).toBe(307)
  })
})

describe('proxy matcher', () => {
  // Next compiles the matcher as a path pattern; this one is a single regex group.
  const matcher = new RegExp(`^${config.matcher[0]}$`)

  it('runs on app pages', () => {
    for (const path of ['/', '/objectives', '/objectives/abc', '/quiz', '/funil', '/entrar', '/cadastro']) {
      expect(matcher.test(path), path).toBe(true)
    }
  })

  it('skips Next internals, the auth API, the manifest and files with an extension', () => {
    for (const path of [
      '/_next/static/chunks/a.js',
      '/_next/image',
      '/api/auth/sign-in/email',
      '/api/auth/get-session',
      '/manifest.webmanifest',
      '/icons/icon-192.png',
      '/favicon.ico',
    ]) {
      expect(matcher.test(path), path).toBe(false)
    }
  })
})
