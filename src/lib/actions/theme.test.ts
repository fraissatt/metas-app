import { beforeEach, describe, expect, it, vi } from 'vitest'

const set = vi.fn()
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ set })),
}))

import { setTheme } from '@/lib/actions/theme'

describe('setTheme', () => {
  beforeEach(() => set.mockClear())

  it('stores the chosen theme in a year-long, script-readable cookie', async () => {
    await setTheme('light')

    expect(set).toHaveBeenCalledWith('theme', 'light', {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
    })
  })

  it('normalises an invalid value to the default instead of storing it', async () => {
    // Server Actions are public endpoints: the type is not a guarantee.
    await setTheme('neon' as never)

    expect(set).toHaveBeenCalledWith('theme', 'dark', expect.any(Object))
  })
})
