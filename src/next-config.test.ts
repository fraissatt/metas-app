import { describe, expect, it } from 'vitest'
import nextConfig, { securityHeaders } from '../next.config'

type Rule = { source: string; headers: Array<{ key: string; value: string }> }

async function rules(): Promise<Rule[]> {
  return (await nextConfig.headers!()) as Rule[]
}

function header(rule: Rule, key: string): string | undefined {
  return rule.headers.find((h) => h.key === key)?.value
}

describe('security headers', () => {
  it('sends the security headers on every path', async () => {
    const all = (await rules()).find((rule) => rule.source === '/:path*')!
    expect(all.headers).toBe(securityHeaders)
    expect(header(all, 'X-Frame-Options')).toBe('DENY')
    expect(header(all, 'X-Content-Type-Options')).toBe('nosniff')
    expect(header(all, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(header(all, 'Strict-Transport-Security')).toMatch(/max-age=\d{8,}/)
  })

  it('blocks framing and plugins without restricting scripts or styles', async () => {
    const csp = header((await rules()).find((rule) => rule.source === '/:path*')!, 'Content-Security-Policy')!
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
    // A script-src without nonces would block Next's inline scripts.
    expect(csp).not.toMatch(/script-src|style-src|default-src/)
  })

  it('keeps the service worker rule last so its stricter CSP wins', async () => {
    const list = await rules()
    const sw = list.at(-1)!
    expect(sw.source).toBe('/sw.js')
    expect(header(sw, 'Content-Security-Policy')).toBe("default-src 'self'; script-src 'self'")
    expect(header(sw, 'Cache-Control')).toContain('no-store')
  })

  it('does not advertise the framework', () => {
    expect(nextConfig.poweredByHeader).toBe(false)
  })
})
