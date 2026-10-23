import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Normalised: a Windows checkout has CRLF line endings.
const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8').replace(/\r\n/g, '\n')

describe('card styles', () => {
  it('leave the cards flat: no gradient and no layered shadows in either theme', () => {
    expect(css).not.toMatch(/\.card-surface/)
    expect(css).not.toMatch(/linear-gradient\(\s*160deg/)
  })

  it('only gives more room in the light theme, with padding that beats the card’s own p-4', () => {
    expect(css).toMatch(/\n:root:not\(\.dark\) \.card-roomy\s*{\s*padding: 1\.25rem/)
    expect(css).toMatch(/\n:root:not\(\.dark\) \.card-roomy-header\s*{\s*padding: 0\.875rem 1\.25rem/)
    expect(css).not.toMatch(/\.dark \.card-roomy/)
    expect(css).not.toMatch(/\n\.card-roomy(-header)?\s*{/)
  })
})
