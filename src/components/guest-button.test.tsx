import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuestButton } from '@/components/guest-button'

describe('GuestButton', () => {
  it('explains the demo and calls onEnter, disabling itself while pending', async () => {
    let resolve!: () => void
    const onEnter = vi.fn(() => new Promise<void>((r) => { resolve = r }))
    render(<GuestButton onEnter={onEnter} />)
    expect(screen.getByText('Conta de demonstração com dados prontos')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Entrar como visitante' })
    await userEvent.click(button)
    expect(onEnter).toHaveBeenCalledOnce()
    expect(button).toBeDisabled()
    resolve()
  })

  it('shows an error and re-enables when onEnter rejects', async () => {
    const onEnter = vi.fn().mockRejectedValue(new Error('boom'))
    render(<GuestButton onEnter={onEnter} />)
    const button = screen.getByRole('button', { name: 'Entrar como visitante' })
    await userEvent.click(button)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir. Tente de novo.')
    expect(button).toBeEnabled()
  })

  it('shows no error when onEnter resolves (successful redirect)', async () => {
    const onEnter = vi.fn().mockResolvedValue(undefined)
    render(<GuestButton onEnter={onEnter} />)
    await userEvent.click(screen.getByRole('button', { name: 'Entrar como visitante' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
