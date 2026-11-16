import Link from 'next/link'
import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ pathname: '/', search: '' }))
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}))

import { NavigationProgress } from './navigation-progress'

function page() {
  return (
    <>
      <NavigationProgress />
      <Link href="/objectives">Objetivos</Link>
      <Link href="/">Hoje</Link>
    </>
  )
}

describe('NavigationProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    nav.pathname = '/'
    nav.search = ''
  })
  afterEach(() => vi.useRealTimers())

  const bar = () => document.querySelector('.nav-progress')

  it('stays hidden until a link to another page is clicked', () => {
    const { getByText } = render(page())
    expect(bar()).toBeNull()

    fireEvent.click(getByText('Hoje'))
    expect(bar()).toBeNull()

    fireEvent.click(getByText('Objetivos'))
    expect(bar()).toHaveAttribute('data-phase', 'loading')
  })

  it('finishes and goes away once the new page arrives', () => {
    const { getByText, rerender } = render(page())
    fireEvent.click(getByText('Objetivos'))

    nav.pathname = '/objectives'
    rerender(page())
    expect(bar()).toHaveAttribute('data-phase', 'done')

    act(() => vi.advanceTimersByTime(500))
    expect(bar()).toBeNull()
  })

  it('gives up if the page never changes', () => {
    const { getByText } = render(page())
    fireEvent.click(getByText('Objetivos'))
    act(() => vi.advanceTimersByTime(16_000))
    expect(bar()).toBeNull()
  })
})
