import { Component, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteButton } from '@/components/delete-button'

describe('DeleteButton', () => {
  it('does not call the action until the confirmation dialog is confirmed', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(<DeleteButton action={action} />)

    await userEvent.click(screen.getByRole('button', { name: /excluir/i }))
    expect(action).not.toHaveBeenCalled()

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/esta ação não pode ser desfeita/i)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: /excluir/i }))

    expect(action).toHaveBeenCalledOnce()
  })

  it('does not call the action when the dialog is cancelled', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(<DeleteButton action={action} />)

    await userEvent.click(screen.getByRole('button', { name: /excluir/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(action).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows a custom confirmation description when provided', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(
      <DeleteButton
        action={action}
        confirmDescription="Isso também excluirá todas as metas semanais relacionadas."
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /excluir/i }))

    expect(screen.getByText(/isso também excluirá todas as metas semanais/i)).toBeInTheDocument()
  })

  it('disables the trigger while the confirmed action is pending', async () => {
    let resolve!: () => void
    const action = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    render(<DeleteButton action={action} />)

    await userEvent.click(screen.getByRole('button', { name: /excluir/i }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /excluir/i }))

    expect(screen.getByRole('button', { name: /excluir/i })).toBeDisabled()

    await act(async () => resolve())
    expect(screen.getByRole('button', { name: /excluir/i })).toBeEnabled()
  })

  it('does not swallow a rejected action', async () => {
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
      state = { failed: false }
      static getDerivedStateFromError() {
        return { failed: true }
      }
      render() {
        return this.state.failed ? <p>deu erro</p> : this.props.children
      }
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const action = vi.fn().mockRejectedValue(new Error('boom'))
    render(
      <Boundary>
        <DeleteButton action={action} />
      </Boundary>,
    )

    await userEvent.click(screen.getByRole('button', { name: /excluir/i }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /excluir/i }))

    expect(await screen.findByText('deu erro')).toBeInTheDocument()
    spy.mockRestore()
  })
})
