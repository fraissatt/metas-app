'use server'

import { cookies } from 'next/headers'
import { parseTheme, THEME_COOKIE, type Theme } from '@/lib/theme'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

// No revalidatePath: the toggle has already repainted the page, and the next
// request reads the cookie anyway.
export async function setTheme(theme: Theme): Promise<void> {
  const store = await cookies()
  store.set(THEME_COOKIE, parseTheme(theme), {
    path: '/',
    sameSite: 'lax',
    maxAge: ONE_YEAR_SECONDS,
    httpOnly: false,
  })
}
