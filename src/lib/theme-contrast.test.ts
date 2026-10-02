import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BROWSER_CHROME } from './theme'

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
  ['accent-foreground', 'background'],
  ['accent-foreground', 'card'],
  ['destructive', 'background'],
]

describe.each([
  ['light', ':root'],
  ['dark', '.dark'],
] as const)('%s palette', (_name, selector) => {
  const vars = palette(selector)

  // The dark --destructive is oklch(), which the hex parser can't read, so that
  // pair is skipped for the dark palette only. The light palette is never
  // filtered, so a missing light token still fails.
  const pairs = selector === '.dark' ? PAIRS.filter(([fg]) => fg !== 'destructive') : PAIRS

  it.each(pairs)('%s on %s meets WCAG AA (4.5:1)', (fg, bg) => {
    expect(vars[fg], `--${fg} missing`).toBeDefined()
    expect(vars[bg], `--${bg} missing`).toBeDefined()
    expect(contrast(vars[fg], vars[bg])).toBeGreaterThanOrEqual(4.5)
  })
})

describe('theme colors stay in tokens', () => {
  const HEX_COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/

  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry)
      return statSync(path).isDirectory() ? files(path) : [path]
    })
  }

  it('no component hardcodes a hex color (it would ignore the active theme)', () => {
    const offenders = files(join(process.cwd(), 'src'))
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => HEX_COLOR.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(process.cwd(), ''))

    expect(offenders).toEqual([])
  })
})

describe('browser chrome (theme-color) matches the page background', () => {
  function rgbToHex(rgb: string): string {
    const channels = rgb.match(/\d+/g)
    if (channels?.length !== 3) throw new Error(`unexpected color: ${rgb}`)
    return '#' + channels.map((c) => Number(c).toString(16).padStart(2, '0')).join('')
  }

  it.each([
    ['light', ':root'],
    ['dark', '.dark'],
  ] as const)('%s theme-color equals --background', (name, selector) => {
    expect(rgbToHex(BROWSER_CHROME[name]).toLowerCase()).toBe(palette(selector).background.toLowerCase())
  })
})
