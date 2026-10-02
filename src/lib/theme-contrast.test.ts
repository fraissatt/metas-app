import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

function palette(selector: ':root' | '.dark'): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const block = css.slice(start, css.indexOf('}', start))
  const vars: Record<string, string> = {}
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    vars[name] = value
  }
  return vars
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const PAIRS: Array<[string, string]> = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['accent-foreground', 'accent'],
  ['support-foreground', 'background'],
  ['support-foreground', 'card'],
  ['primary-foreground', 'primary'],
]

describe.each([
  ['light', ':root'],
  ['dark', '.dark'],
] as const)('%s palette', (_name, selector) => {
  const vars = palette(selector)

  it.each(PAIRS)('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(vars[fg], `--${fg} missing`).toBeDefined()
    expect(vars[bg], `--${bg} missing`).toBeDefined()
    expect(contrast(vars[fg], vars[bg])).toBeGreaterThanOrEqual(4.5)
  })
})

describe('theme colors stay in tokens', () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry)
      return statSync(path).isDirectory() ? files(path) : [path]
    })
  }

  it('no component hardcodes a hex color (it would ignore the active theme)', () => {
    const offenders = files(join(process.cwd(), 'src'))
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => /#[0-9a-fA-F]{6}\b/.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(process.cwd(), ''))

    expect(offenders).toEqual([])
  })
})
