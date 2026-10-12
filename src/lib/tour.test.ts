import { describe, expect, it, vi } from 'vitest'

const get = vi.fn()
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get })) }))

import { getTourSeen, parseTourSeen } from '@/lib/tour'

describe('parseTourSeen', () => {
  it('is true only for the exact value "visto"', () => {
    expect(parseTourSeen('visto')).toBe(true)
    for (const value of [undefined, '', 'Visto', 'true', '1', 'visto ']) {
      expect(parseTourSeen(value)).toBe(false)
    }
  })
})

describe('getTourSeen', () => {
  it('reads the tour cookie', async () => {
    get.mockReturnValueOnce({ value: 'visto' })
    expect(await getTourSeen()).toBe(true)
    expect(get).toHaveBeenLastCalledWith('tour')
  })

  it('is false when the cookie is missing', async () => {
    get.mockReturnValueOnce(undefined)
    expect(await getTourSeen()).toBe(false)
  })
})
