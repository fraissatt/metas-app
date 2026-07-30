import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteButton } from '@/components/delete-button'

describe('DeleteButton', () => {
  it('calls the action when clicked', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(<DeleteButton action={action} />)

    await userEvent.click(screen.getByRole('button', { name: /excluir/i }))

    expect(action).toHaveBeenCalledOnce()
  })
})
