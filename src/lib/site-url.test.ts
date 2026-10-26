import { describe, expect, it } from 'vitest'
import { siteUrl } from '@/lib/site-url'

describe('siteUrl', () => {
  it('uses the production domain on a Vercel production build', () => {
    const url = siteUrl({
      VERCEL_ENV: 'production',
      VERCEL_PROJECT_PRODUCTION_URL: 'metas-app-flax.vercel.app',
      VERCEL_URL: 'metas-app-abc123.vercel.app',
    })
    expect(url.href).toBe('https://metas-app-flax.vercel.app/')
  })

  it('uses the deployment address on a preview', () => {
    expect(siteUrl({ VERCEL_ENV: 'preview', VERCEL_URL: 'metas-app-abc123.vercel.app' }).href).toBe(
      'https://metas-app-abc123.vercel.app/',
    )
  })

  it('falls back to the auth URL, then localhost', () => {
    expect(siteUrl({ BETTER_AUTH_URL: 'http://localhost:3100' }).href).toBe('http://localhost:3100/')
    expect(siteUrl({}).href).toBe('http://localhost:3000/')
  })
})
