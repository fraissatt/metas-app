import { describe, expect, it } from 'vitest'
import { parseDarkPalette, readDarkPalette, withAlpha } from '@/lib/dark-palette'

describe('dark palette', () => {
  it('reads only the hex tokens of the .dark block', () => {
    const css =
      ':root {\n  --primary: #2563c9;\n}\n.dark .card {\n  color: #ffffff;\n}\n.dark{\n  --background: #111214;\n  --primary: #7fd18f;\n  --destructive: oklch(0.7 0.19 22);\n}\n'
    expect(parseDarkPalette(css)).toEqual({ background: '#111214', primary: '#7fd18f' })
  })

  it('has every token the link-preview image uses', async () => {
    const colors = await readDarkPalette()
    for (const token of ['background', 'card', 'border', 'foreground', 'muted', 'muted-foreground', 'primary']) {
      expect(colors[token], token).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('turns a hex colour into rgba', () => {
    expect(withAlpha('#7fd18f', 0.35)).toBe('rgba(127, 209, 143, 0.35)')
  })
})
