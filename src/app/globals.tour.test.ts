import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('tour step styles', () => {
  it('fades the step in, but not for reduced motion', () => {
    expect(css).toMatch(/\.tour-step\s*{[^}]*animation: tour-step-in/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[^}]*\.tour-step\s*{\s*animation: none/)
  })
})
