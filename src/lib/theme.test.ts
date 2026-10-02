import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, parseTheme } from '@/lib/theme'

describe('parseTheme', () => {
  it('defaults to dark when the cookie is missing', () => {
    expect(parseTheme(undefined)).toBe('dark')
    expect(DEFAULT_THEME).toBe('dark')
  })

  it('accepts the two known values', () => {
    expect(parseTheme('dark')).toBe('dark')
    expect(parseTheme('light')).toBe('light')
  })

  it('falls back to dark for anything else, including near misses', () => {
    expect(parseTheme('')).toBe('dark')
    expect(parseTheme('blue')).toBe('dark')
    expect(parseTheme('LIGHT')).toBe('dark')
    expect(parseTheme(' light')).toBe('dark')
  })
})
