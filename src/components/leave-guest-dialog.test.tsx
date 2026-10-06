import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LeaveGuestDialog } from '@/components/leave-guest-dialog'

describe('LeaveGuestDialog', () => {
  it('warns that guest data will be lost and runs the action on confirm', async () => {
    const action = vi.fn(async () => {})
    const onOpenChange = vi.fn()
    render(<LeaveGuestDialog open onOpenChange={onOpenChange} action={action} confirmLabel="Sair" />)
    expect(screen.getByRole('heading', { name: 'Sair da conta de visitante?' })).toBeInTheDocument()
    expect(screen.getByText('Seus dados de visitante serão perdidos.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(action).toHaveBeenCalledOnce()
  })

  it('does nothing on cancel', async () => {
    const action = vi.fn(async () => {})
    const onOpenChange = vi.fn()
    render(<LeaveGuestDialog open onOpenChange={onOpenChange} action={action} confirmLabel="Sair" />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(action).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything())
  })

  it('mentions the sign-up page when leaving to create an account', () => {
    render(
      <LeaveGuestDialog open onOpenChange={vi.fn()} action={vi.fn()} confirmLabel="Continuar" toSignUp />,
    )
    expect(
      screen.getByText('Seus dados de visitante serão perdidos e você vai para o cadastro.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument()
  })
})
