import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LandingFlow } from '@/components/landing-flow'
import { buildLandingDemo } from '@/lib/landing-demo'

const data = buildLandingDemo(new Date('2026-10-14T15:00:00Z'))

type Entry = Pick<IntersectionObserverEntry, 'isIntersecting' | 'target'>
const observers: { callback: (entries: Entry[]) => void; targets: Element[] }[] = []

class FakeObserver {
  targets: Element[] = []
  constructor(public callback: (entries: Entry[]) => void) {
    observers.push(this)
  }
  observe(element: Element) {
    this.targets.push(element)
  }
  unobserve() {}
  disconnect() {}
}

function reach(index: number) {
  const observer = observers[0]
  act(() => observer.callback([{ isIntersecting: true, target: observer.targets[index] }]))
}

beforeEach(() => {
  observers.length = 0
  vi.stubGlobal('IntersectionObserver', FakeObserver)
})
afterEach(() => vi.unstubAllGlobals())

describe('LandingFlow', () => {
  it('lists the three steps in an ordered list, the first one active', () => {
    render(<LandingFlow data={data} />)
    const list = screen.getByRole('list', { name: 'Como funciona' })
    expect(list.tagName).toBe('OL')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveAttribute('aria-current', 'step')
    expect(items[1]).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Falar inglês com fluência')).toBeInTheDocument()
  })

  it('follows the scroll: reaching a step makes it active and switches the demo view', () => {
    render(<LandingFlow data={data} />)
    const items = within(screen.getByRole('list', { name: 'Como funciona' })).getAllByRole('listitem')

    reach(1)
    expect(items[1]).toHaveAttribute('aria-current', 'step')
    expect(items[0]).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Estudar vocabulário todos os dias')).toBeInTheDocument()

    reach(2)
    expect(items[2]).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('checkbox', { name: 'Revisar 20 cartões no Anki' })).toBeInTheDocument()
  })

  it('announces the active step politely', () => {
    render(<LandingFlow data={data} />)
    expect(screen.getByText('Passo 1 de 3: Objetivo')).toBeInTheDocument()
    reach(2)
    expect(screen.getByText('Passo 3 de 3: Tarefa do dia')).toBeInTheDocument()
  })

  it('ignores entries that are not intersecting', () => {
    render(<LandingFlow data={data} />)
    const observer = observers[0]
    act(() => observer.callback([{ isIntersecting: false, target: observer.targets[2] }]))
    expect(screen.getByText('Passo 1 de 3: Objetivo')).toBeInTheDocument()
  })

  it('keeps the tasks the visitor ticked when the view changes', async () => {
    render(<LandingFlow data={data} />)
    reach(2)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Revisar 20 cartões no Anki' }))
    reach(1)
    reach(2)
    expect(screen.getByRole('checkbox', { name: 'Revisar 20 cartões no Anki' })).toBeChecked()
  })

  it('still renders, on step 1, where IntersectionObserver does not exist', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<LandingFlow data={data} />)
    expect(screen.getByText('Passo 1 de 3: Objetivo')).toBeInTheDocument()
  })
})
