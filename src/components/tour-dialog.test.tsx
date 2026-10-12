import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TourDialog } from '@/components/tour-dialog'
import { TOUR_STEPS } from '@/components/tour-steps'

const setup = () => {
  const onOpenChange = vi.fn()
  render(<TourDialog open onOpenChange={onOpenChange} />)
  return onOpenChange
}

describe('TOUR_STEPS', () => {
  it('has the five steps in order', () => {
    expect(TOUR_STEPS.map((step) => step.title)).toEqual([
      'Objetivos',
      'Metas semanais',
      'Tarefas diárias',
      'Busca',
      'Aparência',
    ])
  })
})

describe('TourDialog', () => {
  it('opens on the first step, named and described, without a Voltar button', () => {
    setup()
    const dialog = screen.getByRole('dialog', { name: 'Objetivos' })
    expect(dialog).toHaveAccessibleDescription(TOUR_STEPS[0].text)
    expect(screen.getByText('1 de 5')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Voltar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeInTheDocument()
  })

  it('moves forward and back, updating the indicator', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByRole('dialog', { name: 'Metas semanais' })).toBeInTheDocument()
    expect(screen.getByText('2 de 5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByRole('dialog', { name: 'Objetivos' })).toBeInTheDocument()
    expect(screen.getByText('1 de 5')).toBeInTheDocument()
  })

  it('offers Começar on the last step, which closes the dialog', async () => {
    const onOpenChange = setup()
    for (let i = 0; i < TOUR_STEPS.length - 1; i++) {
      await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    }
    expect(screen.getByRole('dialog', { name: 'Aparência' })).toBeInTheDocument()
    expect(screen.getByText('5 de 5')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Próximo' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Começar' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes with Pular from any step', async () => {
    const onOpenChange = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Pular' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('closes on Escape', async () => {
    const onOpenChange = setup()
    await userEvent.keyboard('{Escape}')
    // Base UI passes an event-details argument after the open flag.
    expect(onOpenChange).toHaveBeenCalledOnce()
    expect(onOpenChange.mock.calls[0][0]).toBe(false)
  })

  it('renders nothing while closed', () => {
    render(<TourDialog open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
