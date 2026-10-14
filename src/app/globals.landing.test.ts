import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('landing card styles', () => {
  it('only lifts the card where a pointer can hover and motion is allowed', () => {
    expect(css).toMatch(/@media \(hover: hover\) and \(prefers-reduced-motion: no-preference\)\s*{[^}]*\.landing-card:hover/)
  })

  it('turns the entrance animation off for reduced motion', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{\s*\.landing-card\s*{\s*animation: none/)
  })

  it('does not hold the entrance end state, which would override the hover transform', () => {
    expect(css).toMatch(/animation: landing-in 500ms ease backwards/)
  })

  it('defines the six colours for both themes', () => {
    for (const name of ['green', 'blue', 'amber', 'violet', 'pink', 'cyan']) {
      expect(css.match(new RegExp(`--lp-${name}:`, 'g'))?.length, name).toBe(2)
    }
  })
})

describe('landing flow styles', () => {
  it('reveals sections on scroll only where scroll-driven animation exists, and not for reduced motion', () => {
    expect(css).toMatch(/@supports \(animation-timeline: view\(\)\)\s*{[^}]*\.landing-reveal/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[^}]*\.landing-reveal\s*{\s*animation: none/)
  })
})
