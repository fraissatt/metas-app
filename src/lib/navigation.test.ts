import { describe, expect, it } from 'vitest'
import { isLinkActive, NAV_LINKS } from '@/lib/navigation'
import { normalizeQuery } from '@/lib/search'

describe('isLinkActive', () => {
  it('treats Hoje as active only on the root', () => {
    expect(isLinkActive('/', '/')).toBe(true)
    expect(isLinkActive('/objectives', '/')).toBe(false)
  })

  it('treats Objetivos as active on it and nested routes', () => {
    expect(isLinkActive('/objectives', '/objectives')).toBe(true)
    expect(isLinkActive('/objectives/123/weeks/456', '/objectives')).toBe(true)
  })

  it('respects path boundaries', () => {
    expect(isLinkActive('/objectives-archive', '/objectives')).toBe(false)
  })

  it('lists the two destinations in order', () => {
    expect(NAV_LINKS.map((l) => l.label)).toEqual(['Hoje', 'Objetivos'])
  })
})

describe('normalizeQuery', () => {
  it('rejects queries shorter than 2 characters after trimming', () => {
    expect(normalizeQuery('')).toBeNull()
    expect(normalizeQuery('  a  ')).toBeNull()
  })

  it('trims and caps at 100 characters', () => {
    expect(normalizeQuery('  corrida ')).toBe('corrida')
    expect(normalizeQuery('x'.repeat(150))).toHaveLength(100)
  })
})
