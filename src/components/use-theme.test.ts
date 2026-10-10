import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { applyTheme, useTheme } from '@/components/use-theme'
import type { Theme } from '@/lib/theme'

const root = document.documentElement

afterEach(() => applyTheme('dark'))

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('applyTheme', () => {
  it('sets the class, the data attribute and the color scheme', () => {
    applyTheme('light')
    expect(root).not.toHaveClass('dark')
    expect(root.dataset.theme).toBe('light')
    expect(root.style.colorScheme).toBe('light')

    applyTheme('dark')
    expect(root).toHaveClass('dark')
    expect(root.dataset.theme).toBe('dark')
  })
})

describe('useTheme', () => {
  it('starts on the given theme', () => {
    const { result } = renderHook(() => useTheme('light', vi.fn()))
    expect(result.current.theme).toBe('light')
  })

  it('repaints immediately and then persists the new theme', async () => {
    applyTheme('dark')
    const save = deferred()
    const onChange = vi.fn(() => save.promise)
    const { result } = renderHook(() => useTheme('dark', onChange))

    await act(async () => result.current.setTheme('light'))

    // The page changes before the save resolves.
    expect(result.current.theme).toBe('light')
    expect(root).not.toHaveClass('dark')
    expect(root.dataset.theme).toBe('light')
    expect(root.style.colorScheme).toBe('light')
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('light'))

    await act(async () => {
      save.resolve()
      await save.promise
    })
    expect(root.dataset.theme).toBe('light')
  })

  it('reverts the repaint if saving fails', async () => {
    applyTheme('dark')
    const onChange = vi.fn().mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useTheme('dark', onChange))

    await act(async () => result.current.setTheme('light'))

    await waitFor(() => expect(result.current.theme).toBe('dark'))
    expect(root).toHaveClass('dark')
    expect(root.dataset.theme).toBe('dark')
  })

  it('serializes saves: a second change waits for the first to finish', async () => {
    applyTheme('dark')
    const first = deferred()
    const onChange = vi.fn((theme: Theme) => (theme === 'light' ? first.promise : Promise.resolve()))
    const { result } = renderHook(() => useTheme('dark', onChange))

    await act(async () => result.current.setTheme('light'))
    await act(async () => result.current.setTheme('dark'))

    // The second save has not started while the first one is pending.
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(root).toHaveClass('dark')

    await act(async () => {
      first.resolve()
      await first.promise
    })
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
    expect(onChange).toHaveBeenNthCalledWith(2, 'dark')
    expect(root.dataset.theme).toBe('dark')
  })

  it('goes back to the last confirmed theme when a later save fails', async () => {
    applyTheme('dark')
    const first = deferred()
    const second = deferred()
    const saves = [first, second]
    const onChange = vi.fn(() => saves[onChange.mock.calls.length - 1].promise)
    const { result } = renderHook(() => useTheme('dark', onChange))

    await act(async () => result.current.setTheme('light'))
    await act(async () => result.current.setTheme('dark'))

    await act(async () => {
      first.resolve()
      await first.promise
    })
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
    expect(root.dataset.theme).toBe('dark')

    await act(async () => {
      second.reject(new Error('offline'))
      await second.promise.catch(() => {})
    })

    // Light was confirmed by the first save; the failed second one falls back to it.
    await waitFor(() => expect(result.current.theme).toBe('light'))
    expect(root).not.toHaveClass('dark')
    expect(root.dataset.theme).toBe('light')
  })

  it('when every save fails, ends on the theme the server last confirmed', async () => {
    applyTheme('dark')
    const saves = [deferred(), deferred(), deferred()]
    const onChange = vi.fn(() => saves[onChange.mock.calls.length - 1].promise)
    const { result } = renderHook(() => useTheme('dark', onChange))

    await act(async () => result.current.setTheme('light'))
    await act(async () => result.current.setTheme('dark'))
    await act(async () => result.current.setTheme('light'))
    expect(onChange).toHaveBeenCalledTimes(1)

    await act(async () => {
      for (const save of saves) {
        save.reject(new Error('offline'))
        await save.promise.catch(() => {})
      }
    })

    expect(onChange).toHaveBeenCalledTimes(3)
    expect(root).toHaveClass('dark')
    expect(result.current.theme).toBe('dark')
  })
})
