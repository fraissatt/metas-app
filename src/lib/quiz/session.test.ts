import { afterEach, describe, expect, it, vi } from 'vitest'
import { isValidSessionId, newSessionId } from '@/lib/quiz/session'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('newSessionId', () => {
  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => '123e4567-e89b-42d3-a456-426614174000' })
    expect(newSessionId()).toBe('123e4567-e89b-42d3-a456-426614174000')
  })

  it('falls back to 32 hex chars from getRandomValues without randomUUID', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.forEach((_, i) => (bytes[i] = i * 17))
        return bytes
      },
    })
    const id = newSessionId()
    expect(id).toMatch(/^[0-9a-f]{32}$/)
    expect(isValidSessionId(id)).toBe(true)
  })

  it('falls back to a time and Math.random id without any crypto', () => {
    vi.stubGlobal('crypto', undefined)
    const id = newSessionId()
    expect(isValidSessionId(id)).toBe(true)
    expect(newSessionId()).not.toBe(id)
  })

  it('always produces a valid id, even when the last-resort id would be short', () => {
    vi.stubGlobal('crypto', undefined)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(isValidSessionId(newSessionId())).toBe(true)
  })
})
