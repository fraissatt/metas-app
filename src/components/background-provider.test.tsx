import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BackgroundProvider, useBackground } from '@/components/background-provider'
import type { BackgroundStyle } from '@/lib/background-options'

vi.mock('@/components/interactive-background', () => ({
  InteractiveBackground: ({ style }: { style: string }) => <div data-testid="bg" data-style={style} />,
}))

function Setter({ values }: { values: BackgroundStyle[] }) {
  const { setStyle } = useBackground()
  return (
    <button
      type="button"
      onClick={() => {
        for (const v of values) setStyle(v)
      }}
    >
      set
    </button>
  )
}

describe('BackgroundProvider', () => {
  it('renders children and the background with the initial style', () => {
    render(
      <BackgroundProvider initial="aurora" onChange={async () => {}}>
        <p>filho</p>
      </BackgroundProvider>,
    )
    expect(screen.getByText('filho')).toBeInTheDocument()
    expect(screen.getByTestId('bg')).toHaveAttribute('data-style', 'aurora')
  })

  it('updates immediately and calls onChange', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined)
    render(
      <BackgroundProvider initial="aurora" onChange={onChange}>
        <Setter values={['pontos']} />
      </BackgroundProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'set' }))
    expect(screen.getByTestId('bg')).toHaveAttribute('data-style', 'pontos')
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('pontos'))
  })

  it('reverts to the last confirmed value when onChange rejects', async () => {
    const onChange = vi.fn().mockRejectedValue(new Error('falhou'))
    render(
      <BackgroundProvider initial="aurora" onChange={onChange}>
        <Setter values={['pontos']} />
      </BackgroundProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'set' }))
    await waitFor(() => expect(screen.getByTestId('bg')).toHaveAttribute('data-style', 'aurora'))
  })

  it('serializes rapid saves in order', async () => {
    const resolvers: Array<() => void> = []
    const onChange = vi.fn(
      () => new Promise<void>((resolve) => resolvers.push(resolve)),
    )
    render(
      <BackgroundProvider initial="aurora" onChange={onChange}>
        <Setter values={['pontos', 'nenhum']} />
      </BackgroundProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'set' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    expect(onChange).toHaveBeenNthCalledWith(1, 'pontos')
    await act(async () => resolvers[0]())
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
    expect(onChange).toHaveBeenNthCalledWith(2, 'nenhum')
    await act(async () => resolvers[1]())
    expect(screen.getByTestId('bg')).toHaveAttribute('data-style', 'nenhum')
  })

  it('throws when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Setter values={[]} />)).toThrow()
    spy.mockRestore()
  })
})
