'use server'

import { cookies } from 'next/headers'
import { parseTheme, THEME_COOKIE, type Theme } from '@/lib/theme'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

// No revalidatePath needed: in Next 16, setting a cookie inside a Server Action
// re-renders the current route. That re-render is what keeps the server-rendered
// <meta name="theme-color"> in sync with the toggle; the toggle has already
// repainted the page itself.
export async function setTheme(theme: Theme): Promise<void> {
  const store = await cookies()
  store.set(THEME_COOKIE, parseTheme(theme), {
    path: '/',
    sameSite: 'lax',
    maxAge: ONE_YEAR_SECONDS,
    httpOnly: false,
  })
}
