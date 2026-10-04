import { cookies } from 'next/headers'
import { BACKGROUND_COOKIE, parseBackground, type BackgroundStyle } from '@/lib/background-options'

export * from '@/lib/background-options'

export async function getBackground(): Promise<BackgroundStyle> {
  const store = await cookies()
  return parseBackground(store.get(BACKGROUND_COOKIE)?.value)
}
