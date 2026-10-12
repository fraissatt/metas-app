import { beforeEach, describe, expect, it, vi } from 'vitest'

const set = vi.fn()
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ set })) }))

import { setTourSeen } from '@/lib/actions/tour'

describe('setTourSeen', () => {
  beforeEach(() => set.mockClear())

  it('stores the seen marker in a year-long, script-readable cookie', async () => {
    await setTourSeen()

    expect(set).toHaveBeenCalledWith('tour', 'visto', {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
    })
  })
})
