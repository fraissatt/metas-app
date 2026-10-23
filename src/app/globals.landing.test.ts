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
      // Counted before the presentation page's own light-theme scope, which repeats three of them.
      const own = css.slice(0, css.indexOf(':has(.landing-root)'))
      expect(own.match(new RegExp(`--lp-${name}:`, 'g'))?.length, name).toBe(2)
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
    // Only the presentation page's light scope (below) may glow.
    expect(css).not.toMatch(/(^|\n)(:root:not\(\.dark\) )?\.landing-step-badge\s*{[^}]*(box|text)-shadow/)
    expect(css).not.toMatch(/\.dark \.landing-step-badge/)
  })
})

describe('landing flow styles', () => {
  it('reveals sections on scroll only where scroll-driven animation exists, and not for reduced motion', () => {
    expect(css).toMatch(/@supports \(animation-timeline: view\(\)\)\s*{[^}]*\.landing-reveal/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[^}]*\.landing-reveal\s*{\s*animation: none/)
  })
})

describe('original light theme on the presentation page', () => {
  const scope = ':root:not(.dark):has(.landing-root)'
  const start = css.indexOf(scope + ' {')
  const block = css.slice(start, css.indexOf('\n}', start))

  it('brings back the ice blue page, the bright blue and the glow, for the page that renders the landing only', () => {
    expect(start, 'scope block').toBeGreaterThan(-1)
    expect(block).toMatch(/--background:\s*#eaf3ff/)
    expect(block).toMatch(/--primary:\s*#0057ff/)
    expect(block).toMatch(/--glow:\s*#0057ff33/)
    expect(block).toMatch(/--lp-green:\s*#22c55e/)
    expect(block).toMatch(/--aurora-wash:\s*0\.16/)
    expect(block).toMatch(/--aurora-glow:\s*0\.85/)
  })

  it('has glowing number seals and bluish layered shadows on the demo surfaces, in that scope only', () => {
    expect(css).toMatch(/:root:not\(\.dark\):has\(\.landing-root\) \.landing-step-badge\s*{[^}]*box-shadow/)
    const surface = css.match(/:root:not\(\.dark\):has\(\.landing-root\) \.landing-surface\s*{([^}]*)}/)
    expect(surface, 'landing-surface rule').not.toBeNull()
    expect(surface?.[1]).toMatch(/linear-gradient/)
    expect(surface?.[1].match(/rgb\(/g)?.length).toBeGreaterThanOrEqual(3)
    expect(css).not.toMatch(/\.dark:has\(\.landing-root\)/)
    expect(css).not.toMatch(/\n\.landing-surface\s*{/)
  })
})
