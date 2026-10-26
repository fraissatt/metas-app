import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export type DarkPalette = Record<string, string>

/**
 * The dark theme's hex tokens, read from globals.css, for places that cannot
 * use CSS variables (the link-preview image). Reading them keeps those places
 * in step with the theme instead of copying colours by hand.
 */
export function parseDarkPalette(css: string): DarkPalette {
  // globals.css has several `.dark` rules; the token block is the one that
  // defines --background.
  for (const [, block] of css.matchAll(/(?:^|\n)\.dark\s*\{([^}]*)\}/g)) {
    if (!/--background:/.test(block)) continue
    const vars: DarkPalette = {}
    for (const [, name, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) vars[name] = value
    return vars
  }
  return {}
}

export async function readDarkPalette(): Promise<DarkPalette> {
  return parseDarkPalette(await readFile(join(process.cwd(), 'src/app/globals.css'), 'utf8'))
}

/** `#rrggbb` at `alpha` (0–1), as `rgba()`. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
