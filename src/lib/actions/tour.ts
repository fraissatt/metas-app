'use server'

import { cookies } from 'next/headers'
import { TOUR_COOKIE, TOUR_SEEN_VALUE } from '@/lib/tour'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function setTourSeen(): Promise<void> {
  const store = await cookies()
  store.set(TOUR_COOKIE, TOUR_SEEN_VALUE, {
    path: '/',
    sameSite: 'lax',
    maxAge: ONE_YEAR_SECONDS,
    httpOnly: false,
  })
}
