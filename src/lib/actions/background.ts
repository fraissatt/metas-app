'use server'

import { cookies } from 'next/headers'
import { BACKGROUND_COOKIE, parseBackground, type BackgroundStyle } from '@/lib/background-options'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function setBackground(style: BackgroundStyle): Promise<void> {
  const store = await cookies()
  store.set(BACKGROUND_COOKIE, parseBackground(style), {
    path: '/',
    sameSite: 'lax',
    maxAge: ONE_YEAR_SECONDS,
    httpOnly: false,
  })
}
