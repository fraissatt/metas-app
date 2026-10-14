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

describe('step colours per theme', () => {
  const darkStart = css.indexOf('.dark {\n  --lp-tint')
  const dark = css.slice(darkStart, css.indexOf('}', darkStart))
  const light = css.slice(css.indexOf('--lp-green: #22c55e'), darkStart)

  it('keeps the dark neon colours as they are, with the text shade equal to the fill', () => {
    expect(dark).toMatch(/--lp-green: #39ff14/)
    expect(dark).toMatch(/--lp-blue: #4f9dff/)
    expect(dark).toMatch(/--lp-amber: #ffb020/)
    for (const name of ['green', 'blue', 'amber']) {
      expect(dark).toContain(`--lp-${name}-ink: var(--lp-${name});`)
    }
  })

  it('has brighter fills with darker text shades in the light theme only', () => {
    expect(light).toMatch(/--lp-green: #22c55e/)
    expect(light).toMatch(/--lp-green-ink: #15803d/)
    expect(light).toMatch(/--lp-blue-ink: #1d4ed8/)
    expect(light).toMatch(/--lp-amber-ink: #b45309/)
  })
})

describe('step titles', () => {
  it('are lit in their own colour with a glow, in the dark theme only', () => {
    expect(css).toMatch(/\.dark \.landing-title\s*{[^}]*color: var\(--card-color\)[^}]*text-shadow/)
    expect(css).not.toMatch(/\n\.landing-title\s*{/)
  })
})

describe('landing flow styles', () => {
  it('reveals sections on scroll only where scroll-driven animation exists, and not for reduced motion', () => {
    expect(css).toMatch(/@supports \(animation-timeline: view\(\)\)\s*{[^}]*\.landing-reveal/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[^}]*\.landing-reveal\s*{\s*animation: none/)
  })
})
