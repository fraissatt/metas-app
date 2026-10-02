import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react-dom/test-utils'
import { ThemeToggle, applyTheme } from '@/components/theme-toggle'

const root = document.documentElement

afterEach(() => applyTheme('dark'))

describe('ThemeToggle', () => {
  it('offers the light theme while dark is active', () => {
    applyTheme('dark')
    render(<ThemeToggle theme="dark" onChange={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'Ativar tema claro' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('offers the dark theme while light is active', () => {
    applyTheme('light')
    render(<ThemeToggle theme="light" onChange={vi.fn()} />)

    const button = screen.getByRole('button', { name: 'Ativar tema escuro' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('repaints immediately and then persists the new theme', async () => {
    applyTheme('dark')
    let resolveChange: () => void
    const changePromise = new Promise<void>((resolve) => {
      resolveChange = resolve
    })
    const onChange = vi.fn(() => changePromise)
    render(<ThemeToggle theme="dark" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ativar tema claro' }))

    // DOM should change immediately, before the save resolves
    await waitFor(() => expect(root).not.toHaveClass('dark'))
    expect(root.dataset.theme).toBe('light')
    expect(root.style.colorScheme).toBe('light')
    expect(screen.getByRole('button', { name: 'Ativar tema escuro' })).toBeInTheDocument()

    // The save is still pending
    expect(onChange).toHaveBeenCalledWith('light')

    // Now let the save complete
    resolveChange!()
    await waitFor(() => {
      // Component state should stabilize with the confirmed theme
      expect(root.dataset.theme).toBe('light')
    })
  })

  it('reverts the repaint if saving fails', async () => {
    applyTheme('dark')
    const onChange = vi.fn().mockRejectedValue(new Error('offline'))
    render(<ThemeToggle theme="dark" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ativar tema claro' }))

    await waitFor(() => expect(root).toHaveClass('dark'))
    expect(root.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Ativar tema claro' })).toBeInTheDocument()
  })

  it('serializes saves: two quick clicks update in order', async () => {
    applyTheme('dark')
    let resolveClick1: () => void
    const click1Promise = new Promise<void>((resolve) => {
      resolveClick1 = resolve
    })

    let callCount = 0
    const onChange = vi.fn(() => {
      callCount++
      return callCount === 1 ? click1Promise : Promise.resolve()
    })
    render(<ThemeToggle theme="dark" onChange={onChange} />)

    const button = screen.getByRole('button')
    // First click: dark -> light, save 1 pending
    await userEvent.click(button)
    expect(root.dataset.theme).toBe('light')
    expect(onChange).toHaveBeenCalledTimes(1)

    // Second click: light -> dark, but save 2 waits for save 1 to complete
    await userEvent.click(button)
    // Save 2 hasn't run yet because save 1 is still pending
    expect(onChange).toHaveBeenCalledTimes(1)

    // Now resolve save 1, which triggers save 2
    await act(async () => {
      resolveClick1!()
      await click1Promise
    })

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
    expect(root.dataset.theme).toBe('dark')
  })

  it('two clicks with both saves rejecting reverts to original theme', async () => {
    applyTheme('dark')

    interface PromiseControl {
      resolve: () => void
      reject: (err: Error) => void
    }

    const promiseControls: PromiseControl[] = []
    const promises = [
      new Promise<void>((resolve, reject) => {
        promiseControls[0] = { resolve, reject }
      }),
      new Promise<void>((resolve, reject) => {
        promiseControls[1] = { resolve, reject }
      }),
    ]

    let callCount = 0
    const onChange = vi.fn(() => {
      callCount++
      return promises[callCount - 1]
    })
    render(<ThemeToggle theme="dark" onChange={onChange} />)

    const button = screen.getByRole('button')
    // Click 1: dark -> light, save 1 pending
    await userEvent.click(button)
    expect(root.dataset.theme).toBe('light')

    // Click 2: light -> dark, save 2 queued
    await userEvent.click(button)
    expect(root.dataset.theme).toBe('dark')

    // onChange called 2 times by UI, but only save 1 started
    expect(onChange).toHaveBeenCalledTimes(1)

    // Reject save 1: queue proceeds to save 2
    await act(async () => {
      promiseControls[0].reject(new Error('offline'))
      await promises[0].catch(() => {})
    })

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
    // After save 2 rejects, reverts to last confirmed (dark, the initial state)
    expect(root.dataset.theme).toBe('dark')

    // Verify final state
    expect(onChange).toHaveBeenNthCalledWith(1, 'light')
    expect(onChange).toHaveBeenNthCalledWith(2, 'dark')
  })

  it('later save failure reverts to confirmed theme', async () => {
    applyTheme('dark')

    interface PromiseControl {
      resolve: () => void
      reject: (err: Error) => void
    }

    const promiseControls: PromiseControl[] = []
    const promises = [
      new Promise<void>((resolve, reject) => {
        promiseControls[0] = { resolve, reject }
      }),
      new Promise<void>((resolve, reject) => {
        promiseControls[1] = { resolve, reject }
      }),
    ]

    let callCount = 0
    const onChange = vi.fn(() => {
      callCount++
      return promises[callCount - 1]
    })
    render(<ThemeToggle theme="dark" onChange={onChange} />)

    const button = screen.getByRole('button')
    // Click 1: dark -> light, save 1 pending
    await userEvent.click(button)
    expect(root.dataset.theme).toBe('light')

    // Click 2: light -> dark, save 2 queued
    await userEvent.click(button)
    expect(root.dataset.theme).toBe('dark')

    // Save 2 hasn't run yet
    expect(onChange).toHaveBeenCalledTimes(1)

    // Resolve save 1: confirms light, then triggers save 2
    await act(async () => {
      promiseControls[0].resolve()
      await promises[0]
    })

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
    // Save 2 has run and is still pending, UI shows dark
    expect(root.dataset.theme).toBe('dark')

    // Now reject save 2: should revert to last confirmed (light)
    await act(async () => {
      promiseControls[1].reject(new Error('offline'))
      await promises[1].catch(() => {})
    })

    // Should revert to light (the confirmed theme from save 1), not stay on dark
    await waitFor(() => expect(root).not.toHaveClass('dark'))
    expect(root.dataset.theme).toBe('light')
    expect(screen.getByRole('button', { name: 'Ativar tema escuro' })).toBeInTheDocument()
  })
})
