import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { FloatingBar } from '@/components/floating-bar'

let matches = true
let scrollY = 0

function scrollTo(y: number) {
  scrollY = y
  act(() => {
    fireEvent.scroll(window)
  })
}

beforeEach(() => {
  matches = true
  scrollY = 0
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const bar = () => screen.getByTestId('bar')

function setup(props: Partial<ComponentProps<typeof FloatingBar>> = {}) {
  return render(
    <FloatingBar edge="top" data-testid="bar" {...props}>
      <button type="button">Dentro</button>
      <button type="button" aria-expanded="false">
        Menu
      </button>
    </FloatingBar>,
  )
}

describe('FloatingBar', () => {
  it('is shown at first, with its edge on the element', () => {
    setup()
    expect(bar()).toHaveAttribute('data-edge', 'top')
    expect(bar()).toHaveAttribute('data-hidden', 'false')
    expect(bar()).not.toHaveAttribute('inert')
  })

  it('hides (and becomes inert) when scrolling down past the threshold, and returns when scrolling up', () => {
    setup()
    scrollTo(200)
    expect(bar()).toHaveAttribute('data-hidden', 'true')
    expect(bar()).toHaveAttribute('inert')
    scrollTo(150)
    expect(bar()).toHaveAttribute('data-hidden', 'false')
    expect(bar()).not.toHaveAttribute('inert')
  })

  it('slides out upwards at the top edge and downwards at the bottom edge', () => {
    const { unmount } = setup()
    scrollTo(200)
    expect(bar().className).toMatch(/-translate-y-/)
    unmount()
    scrollTo(0)
    setup({ edge: 'bottom' })
    scrollTo(200)
    expect(bar().className).toMatch(/(^|\s)translate-y-/)
    expect(bar().className).not.toMatch(/-translate-y-/)
  })

  it('never hides a page that is too short to scroll', () => {
    setup()
    scrollTo(60)
    expect(bar()).toHaveAttribute('data-hidden', 'false')
  })

  it('stays while focus is inside it', () => {
    setup()
    act(() => screen.getByRole('button', { name: 'Dentro' }).focus())
    scrollTo(300)
    expect(bar()).toHaveAttribute('data-hidden', 'false')
  })

  it('stays while one of its menus is open', () => {
    setup()
    screen.getByRole('button', { name: 'Menu' }).setAttribute('aria-expanded', 'true')
    scrollTo(300)
    expect(bar()).toHaveAttribute('data-hidden', 'false')
  })

  it('stays while a dialog is open somewhere on the page', () => {
    setup()
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.append(dialog)
    scrollTo(300)
    expect(bar()).toHaveAttribute('data-hidden', 'false')
  })

  it('does not hide where its media query does not match (the plain phone bar, or desktop for the bottom bar)', () => {
    matches = false
    setup({ when: '(min-width: 768px)' })
    scrollTo(300)
    expect(bar()).toHaveAttribute('data-hidden', 'false')
    expect(bar()).not.toHaveAttribute('inert')
  })

  it('only transitions when motion is allowed', () => {
    setup()
    expect(bar().className).toMatch(/motion-safe:transition/)
    expect(bar().className).not.toMatch(/(^|\s)transition/)
  })

  it('stops listening to the scroll when it goes away', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = setup()
    unmount()
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
  })
})
