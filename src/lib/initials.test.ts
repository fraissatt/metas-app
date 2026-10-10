import { describe, expect, it } from 'vitest'
import { initialsOf } from '@/lib/initials'

describe('initialsOf', () => {
  it('takes the first letter of the first two words, upper-cased', () => {
    expect(initialsOf('ana maria silva')).toBe('AM')
    expect(initialsOf('João Vítor')).toBe('JV')
  })

  it('uses a single letter for a single word', () => {
    expect(initialsOf('Visitante')).toBe('V')
  })

  it('ignores extra whitespace', () => {
    expect(initialsOf('  Ana   Maria ')).toBe('AM')
  })

  it('falls back to a question mark for an empty name', () => {
    expect(initialsOf('   ')).toBe('?')
    expect(initialsOf('')).toBe('?')
  })
})
