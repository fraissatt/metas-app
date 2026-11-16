import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { RefreshOnFocus } from '@/components/refresh-on-focus'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

let now = 1_000_000

beforeEach(() => {
  now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
})

afterEach(() => {
  refresh.mockClear()
  vi.restoreAllMocks()
})

describe('RefreshOnFocus', () => {
  it('renders nothing', () => {
    const { container } = render(<RefreshOnFocus />)
    expect(container).toBeEmptyDOMElement()
  })

  it('refreshes the router when the window gets focus', () => {
    render(<RefreshOnFocus />)
    fireEvent.focus(window)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not refresh again within 60 seconds', () => {
    render(<RefreshOnFocus />)
    fireEvent.focus(window)
    now += 59_000
    fireEvent.focus(window)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refreshes again once more than 60 seconds have passed', () => {
    render(<RefreshOnFocus />)
    fireEvent.focus(window)
    now += 61_000
    fireEvent.focus(window)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('refreshes when the tab becomes visible', () => {
    render(<RefreshOnFocus />)
    fireEvent(document, new Event('visibilitychange'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not refresh when the tab becomes hidden', () => {
    render(<RefreshOnFocus />)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('stops listening after unmount', () => {
    const { unmount } = render(<RefreshOnFocus />)
    unmount()
    fireEvent.focus(window)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refreshes by itself when the Brasília day turns, and again the next day', () => {
    vi.restoreAllMocks()
    vi.useFakeTimers()
    // 23:59:30 in Brasília (UTC-3).
    vi.setSystemTime(new Date('2026-11-17T02:59:30Z'))
    try {
      render(<RefreshOnFocus />)
      vi.advanceTimersByTime(29_000)
      expect(refresh).not.toHaveBeenCalled()

      vi.advanceTimersByTime(4_000)
      expect(refresh).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(24 * 60 * 60 * 1000)
      expect(refresh).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels the day-turn refresh when it unmounts', () => {
    vi.restoreAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-17T02:59:30Z'))
    try {
      render(<RefreshOnFocus />).unmount()
      vi.advanceTimersByTime(60_000)
      expect(refresh).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
