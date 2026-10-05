import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NAV_LINKS } from '@/lib/navigation'
import { BROWSER_CHROME, DEFAULT_THEME } from '@/lib/theme'
import manifest from './manifest'

const m = manifest()

describe('web app manifest', () => {
  it('opens the app standalone, at its root, in pt-BR', () => {
    expect(m.display).toBe('standalone')
    expect(m.start_url).toBe('/')
    expect(m.lang).toBe('pt-BR')
  })

  it('is named after the app', () => {
    expect(m.name).toBe('Metas')
    expect(m.short_name).toBe('Metas')
    expect(m.description).toBeTruthy()
  })

  it('splash and toolbar colors follow the default theme, like <meta name="theme-color">', () => {
    expect(m.theme_color).toBe(BROWSER_CHROME[DEFAULT_THEME])
    expect(m.background_color).toBe(BROWSER_CHROME[DEFAULT_THEME])
  })

  it('offers the 192 and 512 icons Chrome needs to install, plus a maskable one', () => {
    const icons = m.icons ?? []
    const has = (sizes: string, purpose: string) =>
      icons.some((i) => i.sizes === sizes && i.type === 'image/png' && (i.purpose ?? 'any') === purpose)

    expect(has('192x192', 'any')).toBe(true)
    expect(has('512x512', 'any')).toBe(true)
    expect(has('512x512', 'maskable')).toBe(true)
  })

  it('only points at icon files that exist in public/', () => {
    for (const icon of m.icons ?? []) {
      expect(existsSync(join(process.cwd(), 'public', icon.src)), icon.src).toBe(true)
    }
  })

  it('has one home-screen shortcut per navigation link', () => {
    const shortcuts = (m.shortcuts ?? []).map((s) => ({ name: s.name, url: s.url }))

    expect(shortcuts).toEqual(NAV_LINKS.map((l) => ({ name: l.label, url: l.href })))
  })
})
