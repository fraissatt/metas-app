import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Normalised: a Windows checkout has CRLF line endings.
const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8').replace(/\r\n/g, '\n')

describe('island style', () => {
  const rule = css.match(/@utility island\s*{([\s\S]*?)\n}/)

  it('is a glass bar: translucent card colour, blur, a fine border and the theme shadow', () => {
    expect(rule, '@utility island').not.toBeNull()
    expect(rule?.[1]).toMatch(/background-color: color-mix\(in oklab, var\(--card\)/)
    expect(rule?.[1]).toMatch(/backdrop-filter: blur\(/)
    expect(rule?.[1]).toMatch(/border: 1px solid/)
    expect(rule?.[1]).toMatch(/box-shadow: var\(--island-shadow\)/)
  })

  it('has layered, bluish shadows in the light theme', () => {
    const light = css.match(/:root {\s*--island-shadow:([^;]*);/)
    expect(light, 'light --island-shadow').not.toBeNull()
    expect(light?.[1].match(/rgb\(/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('has its own dark shadow, so the neon stays on the active link only', () => {
    const dark = css.match(/\.dark {\s*--island-shadow:([^;]*);/)
    expect(dark, 'dark --island-shadow').not.toBeNull()
    expect(dark?.[1]).toMatch(/rgb\(0 0 0/)
  })
})
