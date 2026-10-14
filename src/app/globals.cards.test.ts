import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Normalised: a Windows checkout has CRLF line endings.
const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8').replace(/\r\n/g, '\n')

describe('card styles', () => {
  it('give the cards layered shadows and a pastel gradient in the light theme only', () => {
    const rule = css.match(/:root:not\(\.dark\) \.card-surface\s*{([^}]*)}/)
    expect(rule, 'light card-surface rule').not.toBeNull()
    expect(rule?.[1]).toMatch(/linear-gradient/)
    expect(rule?.[1].match(/rgb\(/g)?.length).toBeGreaterThanOrEqual(3)
    expect(css).not.toMatch(/\.dark \.card-surface/)
    expect(css).not.toMatch(/\n\.card-surface\s*{/)
  })

  it('keeps the surface rule in the components layer, so a glow utility on a card still wins', () => {
    const layer = css.indexOf('@layer components {')
    expect(layer).toBeGreaterThan(-1)
    expect(css.indexOf(':root:not(.dark) .card-surface')).toBeGreaterThan(layer)
    expect(css.indexOf(':root:not(.dark) .card-roomy {')).toBeGreaterThan(css.indexOf('@layer components {'))
    // The padding is outside the layer on purpose, to beat the card's own p-4.
    expect(css).toMatch(/}\n\n:root:not\(\.dark\) \.card-roomy\s*{\s*padding: 1\.25rem/)
  })

  it('only gives more room in the light theme', () => {
    expect(css).not.toMatch(/\.dark \.card-roomy/)
    expect(css).not.toMatch(/\n\.card-roomy(-header)?\s*{/)
  })
})
