import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('flips from what is shown, so two quick clicks return to the start', async () => {
    applyTheme('dark')
    // Never resolves: both clicks happen while the first save is in flight.
    const onChange = vi.fn(() => new Promise<void>(() => {}))
    render(<ThemeToggle theme="dark" onChange={onChange} />)

    const button = screen.getByRole('button')
    await userEvent.click(button)
    await userEvent.click(button)

    expect(root).toHaveClass('dark')
    expect(onChange).toHaveBeenNthCalledWith(1, 'light')
    expect(onChange).toHaveBeenNthCalledWith(2, 'dark')
  })

  it('two clicks with both saves rejecting should end on original theme', async () => {
    applyTheme('dark')
    let resolveClick1: () => void
    let rejectClick1: (err: Error) => void
    const click1Promise = new Promise<void>((resolve, reject) => {
      resolveClick1 = resolve
      rejectClick1 = reject
    })

    let resolveClick2: () => void
    let rejectClick2: (err: Error) => void
    const click2Promise = new Promise<void>((resolve, reject) => {
      resolveClick2 = resolve
      rejectClick2 = reject
    })

    let callCount = 0
    const onChange = vi.fn(() => {
      callCount++
      return callCount === 1 ? click1Promise : click2Promise
    })
    render(<ThemeToggle theme="dark" onChange={onChange} />)

    const button = screen.getByRole('button')
    // First click: dark -> light, save pending
    await userEvent.click(button)
    expect(root.dataset.theme).toBe('light')

    // Second click: light -> dark, save pending
    await userEvent.click(button)
    expect(root.dataset.theme).toBe('dark')

    // Both rejections happen in order
    rejectClick1!(new Error('offline'))
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
    rejectClick2!(new Error('offline'))
    await waitFor(() => expect(root).toHaveClass('dark'))

    // Should end on original dark theme
    expect(root.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Ativar tema claro' })).toBeInTheDocument()
  })

  it('click 1 pending, click 2 resolves, then click 1 rejects should stay on click 2 theme', async () => {
    applyTheme('dark')
    let resolveClick1: () => void
    let rejectClick1: (err: Error) => void
    const click1Promise = new Promise<void>((resolve, reject) => {
      resolveClick1 = resolve
      rejectClick1 = reject
    })

    let resolveClick2: () => void
    const click2Promise = Promise.resolve()

    let callCount = 0
    const onChange = vi.fn(() => {
      callCount++
      return callCount === 1 ? click1Promise : click2Promise
    })
    render(<ThemeToggle theme="dark" onChange={onChange} />)

    const button = screen.getByRole('button')
    // First click: dark -> light, save pending
    await userEvent.click(button)
    expect(root.dataset.theme).toBe('light')

    // Second click: light -> dark, save resolves
    await userEvent.click(button)
    await waitFor(() => expect(root.dataset.theme).toBe('dark'))

    // Now click 1 rejects - should NOT revert because click 2 succeeded
    rejectClick1!(new Error('offline'))
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))

    // Should stay on dark (click 2's confirmed theme)
    expect(root.dataset.theme).toBe('dark')
    expect(root).toHaveClass('dark')
    expect(screen.getByRole('button', { name: 'Ativar tema claro' })).toBeInTheDocument()
  })
})
