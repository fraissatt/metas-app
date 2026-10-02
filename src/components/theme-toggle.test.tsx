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
    const onChange = vi.fn().mockResolvedValue(undefined)
    render(<ThemeToggle theme="dark" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ativar tema claro' }))

    expect(root).not.toHaveClass('dark')
    expect(root.dataset.theme).toBe('light')
    expect(root.style.colorScheme).toBe('light')
    expect(onChange).toHaveBeenCalledWith('light')
    expect(screen.getByRole('button', { name: 'Ativar tema escuro' })).toBeInTheDocument()
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
})
