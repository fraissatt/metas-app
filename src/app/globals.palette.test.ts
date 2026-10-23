import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Normalised: a Windows checkout has CRLF line endings.
const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8').replace(/\r\n/g, '\n')

function block(selector: string): string {
  const start = css.indexOf(`\n${selector} {`)
  expect(start, `${selector} block`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('\n}', start))
}

describe('calmer palettes', () => {
  const light = block(':root')
  const dark = block('.dark')

  it('has no glow in either theme', () => {
    expect(light).toMatch(/--glow:\s*transparent/)
    expect(dark).toMatch(/--glow:\s*transparent/)
  })

  it('uses a light cool grey page and a calm blue in the light theme', () => {
    expect(light).toMatch(/--background:\s*#f4f6f9/)
    expect(light).toMatch(/--primary:\s*#2563c9/)
  })

  it('uses a flat near-black page and a soft green in the dark theme', () => {
    expect(dark).toMatch(/--background:\s*#111214/)
    expect(dark).toMatch(/--primary:\s*#7fd18f/)
  })

  it('defines a soft floating-bar shadow per theme, without the old bluish glow', () => {
    expect(css).toMatch(/:root\s*{\s*--island-shadow:/)
    expect(css).toMatch(/\.dark\s*{\s*--island-shadow:/)
    const light = css.match(/\n:root\s*{\s*--island-shadow:([^;]*);/)
    expect(light?.[1]).not.toMatch(/rgb\(0 87 255/)
  })
})
