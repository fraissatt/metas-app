import { describe, expect, it } from 'vitest'
import { isFunnelPublic, isPublicPath } from '@/lib/public-routes'

describe('isPublicPath', () => {
  it('always allows the auth pages', () => {
    expect(isPublicPath('/entrar', false)).toBe(true)
    expect(isPublicPath('/cadastro', false)).toBe(true)
  })

  it('protects app pages', () => {
    for (const path of ['/', '/objectives', '/objectives/abc', '/quiz', '/week']) {
      expect(isPublicPath(path, true)).toBe(false)
    }
  })

  it('opens /funil only when the funnel is public', () => {
    expect(isPublicPath('/funil', true)).toBe(true)
    expect(isPublicPath('/funil', false)).toBe(false)
  })

  it('does not treat lookalike paths as public', () => {
    expect(isPublicPath('/entrarx', false)).toBe(false)
    expect(isPublicPath('/funil-secreto', true)).toBe(false)
  })
})

describe('isFunnelPublic', () => {
  it('is true only for the exact string "true"', () => {
    expect(isFunnelPublic({ FUNNEL_PUBLIC: 'true' })).toBe(true)
    for (const v of [undefined, '', 'TRUE', '1', 'false']) {
      expect(isFunnelPublic({ FUNNEL_PUBLIC: v })).toBe(false)
    }
  })
})
