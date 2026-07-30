import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
})
