import { cookies } from 'next/headers'

export type Theme = 'dark' | 'light'

export const DEFAULT_THEME: Theme = 'dark'
export const THEME_COOKIE = 'theme'

// Exact match on purpose: the cookie is only ever written by `setTheme`, so
// anything else is tampering or a stale format and gets the default.
export function parseTheme(value: string | undefined): Theme {
  return value === 'light' || value === 'dark' ? value : DEFAULT_THEME
}

export async function getTheme(): Promise<Theme> {
  const store = await cookies()
  return parseTheme(store.get(THEME_COOKIE)?.value)
}
