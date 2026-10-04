import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BackgroundPicker } from '@/components/background-picker'
import { BackgroundProvider } from '@/components/background-provider'

vi.mock('@/components/interactive-background', () => ({
  InteractiveBackground: ({ style }: { style: string }) => <div data-testid="bg" data-style={style} />,
}))

function setup(onChange = vi.fn().mockResolvedValue(undefined)) {
  render(
    <BackgroundProvider initial="aurora" onChange={onChange}>
      <BackgroundPicker />
    </BackgroundProvider>,
  )
  return onChange
}

describe('BackgroundPicker', () => {
  it('labels the trigger with the current style', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Fundo: Aurora' })).toBeInTheDocument()
  })

  it('lists the options with the current one checked', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Fundo: Aurora' }))
    expect(await screen.findByRole('menuitemradio', { name: 'Aurora' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('menuitemradio', { name: 'Grade de pontos' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('menuitemradio', { name: 'Nenhum' })).toBeInTheDocument()
  })

  it('selects an option', async () => {
    const onChange = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Fundo: Aurora' }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Grade de pontos' }))
    expect(screen.getByTestId('bg')).toHaveAttribute('data-style', 'pontos')
    expect(screen.getByRole('button', { name: 'Fundo: Grade de pontos' })).toBeInTheDocument()
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('pontos'))
  })

  it('closes on Escape', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Fundo: Aurora' }))
    await screen.findByRole('menu')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })
})
