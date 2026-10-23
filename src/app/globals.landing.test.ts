import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Normalised: a Windows checkout has CRLF line endings, and the slices below look for LF.
const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8').replace(/\r\n/g, '\n')

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
  const light = css.slice(css.indexOf('--lp-green: #3aa76d'), darkStart)

  it('uses calm dark colours, with the text shade equal to the fill', () => {
    expect(dark).toMatch(/--lp-green: #7fd18f/)
    expect(dark).toMatch(/--lp-blue: #6ea8ff/)
    expect(dark).toMatch(/--lp-amber: #e3b865/)
    expect(dark).not.toMatch(/#39ff14/)
    for (const name of ['green', 'blue', 'amber']) {
      expect(dark).toContain(`--lp-${name}-ink: var(--lp-${name});`)
    }
  })

  it('has brighter fills with darker text shades in the light theme only', () => {
    expect(light).toMatch(/--lp-green: #3aa76d/)
    expect(light).toMatch(/--lp-blue: #4f86d8/)
    expect(light).toMatch(/--lp-amber: #e0a43a/)
    expect(light).toMatch(/--lp-green-ink: #15803d/)
    expect(light).toMatch(/--lp-blue-ink: #1d4ed8/)
    expect(light).toMatch(/--lp-amber-ink: #b45309/)
  })
})

describe('step titles', () => {
  it('are lit in their own colour in the dark theme, with no glow', () => {
    expect(css).toMatch(/\.dark \.landing-title\s*{[^}]*color: var\(--card-color\)/)
    expect(css).not.toMatch(/\.landing-title\s*{[^}]*text-shadow/)
  })

  it('take the dark shade of the topic colour in the light theme', () => {
    expect(css).toMatch(/(^|\s)\.landing-title\s*{[^}]*color: var\(--card-ink\)/)
  })
})

describe('step number badge', () => {
  it('is a tinted circle by default, and a solid seal of the topic colour in the light theme only, with no glow', () => {
    expect(css).toMatch(/(^|\s)\.landing-step-badge\s*{[^}]*color: var\(--card-ink\)[^}]*background: color-mix/)
    expect(css).toMatch(/:root:not\(\.dark\) \.landing-step-badge\s*{[^}]*background: var\(--card-color\)/)
    expect(css).not.toMatch(/\.landing-step-badge\s*{[^}]*(box|text)-shadow/)
    expect(css).not.toMatch(/\.dark \.landing-step-badge/)
  })
})

describe('landing flow styles', () => {
  it('reveals sections on scroll only where scroll-driven animation exists, and not for reduced motion', () => {
    expect(css).toMatch(/@supports \(animation-timeline: view\(\)\)\s*{[^}]*\.landing-reveal/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[^}]*\.landing-reveal\s*{\s*animation: none/)
  })
})
