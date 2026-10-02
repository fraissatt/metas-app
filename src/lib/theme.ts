import { cookies } from 'next/headers'

export type Theme = 'dark' | 'light'

export const DEFAULT_THEME: Theme = 'dark'
export const THEME_COOKIE = 'theme'

// Mirrors `--background` for each theme in globals.css (a test keeps them in
// sync). A CSS variable can't be used for <meta name="theme-color">. Lives here
// rather than in layout.tsx because layouts may only export Next's own names.
export const BROWSER_CHROME = { dark: 'rgb(13 15 19)', light: 'rgb(236 238 242)' } as const

// Exact match on purpose: the cookie is only ever written by `setTheme`, so
// anything else is tampering or a stale format and gets the default.
export function parseTheme(value: string | undefined): Theme {
  return value === 'light' || value === 'dark' ? value : DEFAULT_THEME
}

export async function getTheme(): Promise<Theme> {
  const store = await cookies()
  return parseTheme(store.get(THEME_COOKIE)?.value)
}
