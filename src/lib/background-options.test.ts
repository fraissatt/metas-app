import { describe, expect, it } from 'vitest'
import { BACKGROUND_LABELS, BACKGROUND_STYLES, parseBackground } from '@/lib/background-options'

describe('parseBackground', () => {
  it('defaults to aurora for missing or unknown values', () => {
    expect(parseBackground(undefined)).toBe('aurora')
    expect(parseBackground('')).toBe('aurora')
    expect(parseBackground('Aurora')).toBe('aurora')
    expect(parseBackground(' pontos')).toBe('aurora')
    expect(parseBackground('neve')).toBe('aurora')
  })

  it('accepts the three exact values', () => {
    expect(parseBackground('aurora')).toBe('aurora')
    expect(parseBackground('pontos')).toBe('pontos')
    expect(parseBackground('nenhum')).toBe('nenhum')
  })

  it('labels every option in Portuguese, in menu order', () => {
    expect(BACKGROUND_STYLES.map((s) => BACKGROUND_LABELS[s])).toEqual(['Aurora', 'Grade de pontos', 'Nenhum'])
  })
})
