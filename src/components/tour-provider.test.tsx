import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TourProvider, useTour } from '@/components/tour-provider'

const pathname = vi.hoisted(() => ({ current: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }))

function OpenButton() {
  const { openTour } = useTour()
  return <button onClick={openTour}>Abrir tour</button>
}

function setup(props: { initialSeen?: boolean; canOpen?: boolean; onSeen?: () => Promise<void> } = {}) {
  const onSeen = props.onSeen ?? vi.fn(async () => {})
  // A fresh element each time, so a rerender is not skipped as unchanged.
  const ui = () => (
    <TourProvider initialSeen={props.initialSeen ?? false} canOpen={props.canOpen ?? true} onSeen={onSeen}>
      <OpenButton />
    </TourProvider>
  )
  const view = render(ui())
  return { onSeen, rerender: () => view.rerender(ui()) }
}

beforeEach(() => {
  pathname.current = '/'
})

describe('TourProvider', () => {
  it('opens by itself on the first visit of someone with a session', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Objetivos' })).toBeInTheDocument()
  })

  it('stays closed without a session', () => {
    setup({ canOpen: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('stays closed when it was already seen', () => {
    setup({ initialSeen: true })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('stays closed on the quiz', () => {
    pathname.current = '/quiz'
    setup()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens after navigating from the quiz to another page', () => {
    pathname.current = '/quiz'
    const { rerender } = setup()
    expect(screen.queryByRole('dialog')).toBeNull()

    pathname.current = '/'
    rerender()
    expect(screen.getByRole('dialog', { name: 'Objetivos' })).toBeInTheDocument()
  })

  it('marks the tour as seen once when it closes, whichever way', async () => {
    const { onSeen } = setup()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onSeen).toHaveBeenCalledOnce()
  })

  it('does not open by itself again after it was closed', async () => {
    const { rerender } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Pular' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    pathname.current = '/objectives'
    rerender()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('reopens on the first step with openTour, without saving again', async () => {
    const { onSeen } = setup({ initialSeen: true })
    await userEvent.click(screen.getByRole('button', { name: 'Abrir tour' }))
    expect(screen.getByRole('dialog', { name: 'Objetivos' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByRole('dialog', { name: 'Metas semanais' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Pular' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    await userEvent.click(screen.getByRole('button', { name: 'Abrir tour' }))
    expect(screen.getByRole('dialog', { name: 'Objetivos' })).toBeInTheDocument()
    expect(onSeen).not.toHaveBeenCalled()
  })

  it('survives a failing save', async () => {
    const onSeen = vi.fn().mockRejectedValue(new Error('offline'))
    setup({ onSeen })
    await userEvent.click(screen.getByRole('button', { name: 'Pular' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onSeen).toHaveBeenCalledOnce()
  })
})

describe('useTour', () => {
  it('throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<OpenButton />)).toThrow('useTour must be used inside TourProvider')
    spy.mockRestore()
  })
})
