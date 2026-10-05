import { beforeEach, describe, expect, it, vi } from 'vitest'

const set = vi.fn()
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ set })) }))

import { setBackground } from '@/lib/actions/background'

describe('setBackground', () => {
  beforeEach(() => set.mockClear())

  it('stores the choice in a year-long, script-readable cookie', async () => {
    await setBackground('pontos')
    expect(set).toHaveBeenCalledWith('fundo', 'pontos', {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: false,
    })
  })

  it('normalises invalid input to the default', async () => {
    await setBackground('neve' as never)
    expect(set).toHaveBeenCalledWith('fundo', 'aurora', expect.any(Object))
  })
})
