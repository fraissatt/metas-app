import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { hexToRgb, InteractiveBackground } from './interactive-background'

function stubMatchMedia(matching: string[]) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  const context = {
    setTransform() {},
    clearRect() {},
    fillRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    createRadialGradient: () => ({ addColorStop() {} }),
    fillStyle: '',
  }
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => context,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext
  stubMatchMedia([])
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('hexToRgb', () => {
  it('parses #rrggbb', () => {
    expect(hexToRgb('#39ff14')).toEqual([57, 255, 20])
  })

  it('trims whitespace and accepts uppercase', () => {
    expect(hexToRgb(' #1F6BFF ')).toEqual([31, 107, 255])
  })

  it('returns null for non-hex values', () => {
    expect(hexToRgb('oklch(0.7 0.1 20)')).toBeNull()
  })
})

describe('InteractiveBackground', () => {
  it('renders no canvas for nenhum', () => {
    const { container } = render(<InteractiveBackground style="nenhum" />)
    expect(container.querySelector('canvas')).toBeNull()
  })

  it.each(['aurora', 'pontos'] as const)(
    'renders one decorative fixed canvas for %s',
    (style) => {
      const { container } = render(<InteractiveBackground style={style} />)
      const canvases = container.querySelectorAll('canvas')
      expect(canvases).toHaveLength(1)
      const canvas = canvases[0]
      expect(canvas.getAttribute('aria-hidden')).toBe('true')
      for (const cls of ['pointer-events-none', 'fixed', 'inset-0', '-z-10']) {
        expect(canvas.classList.contains(cls)).toBe(true)
      }
    },
  )

  it('draws a single static frame under reduced motion', async () => {
    stubMatchMedia(['(prefers-reduced-motion: reduce)'])
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    render(<InteractiveBackground style="aurora" />)
    expect(raf.mock.calls.length).toBeLessThanOrEqual(1)
    const count = raf.mock.calls.length
    await new Promise((r) => setTimeout(r, 50))
    expect(raf.mock.calls.length).toBe(count)
  })

  it('cleans up listeners and frames on unmount', () => {
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<InteractiveBackground style="aurora" />)
    unmount()
    expect(cancel).toHaveBeenCalled()
    expect(remove.mock.calls.map((c) => c[0])).toContain('pointermove')
  })
})
