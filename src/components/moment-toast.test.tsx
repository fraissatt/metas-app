import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MomentToast } from './moment-toast'

const moment = { title: 'Semana fechada', body: 'Descanse sem culpa.' }

describe('MomentToast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('keeps an empty live region until there is something to say', () => {
    render(<MomentToast moment={null} onDone={vi.fn()} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('says the moment in the live region and leaves by itself', () => {
    const onDone = vi.fn()
    render(<MomentToast moment={moment} onDone={onDone} />)
    expect(screen.getByRole('status')).toHaveTextContent('Semana fechada')
    expect(screen.getByRole('status')).toHaveTextContent('Descanse sem culpa.')

    act(() => vi.advanceTimersByTime(6900))
    expect(onDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(200))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('can be closed, and waits while the pointer or the focus is on it', () => {
    const onDone = vi.fn()
    const { container } = render(<MomentToast moment={moment} onDone={onDone} />)
    const card = container.ownerDocument.querySelector('[data-moment]') as HTMLElement

    fireEvent.mouseEnter(card)
    act(() => vi.advanceTimersByTime(20_000))
    expect(onDone).not.toHaveBeenCalled()

    fireEvent.mouseLeave(card)
    act(() => vi.advanceTimersByTime(7100))
    expect(onDone).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    expect(onDone).toHaveBeenCalledTimes(2)
  })
})
