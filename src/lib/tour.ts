import { cookies } from 'next/headers'

export const TOUR_COOKIE = 'tour'
export const TOUR_SEEN_VALUE = 'visto'

// Exact match: the cookie is only written by setTourSeen, so anything else is
// tampering or a stale format and counts as not seen.
export function parseTourSeen(value: string | undefined): boolean {
  return value === TOUR_SEEN_VALUE
}

export async function getTourSeen(): Promise<boolean> {
  const store = await cookies()
  return parseTourSeen(store.get(TOUR_COOKIE)?.value)
}
