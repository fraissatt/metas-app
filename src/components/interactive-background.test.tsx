import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import {
  hexToRgb,
  InteractiveBackground,
  stepPull,
} from './interactive-background'

function stubMatchMedia(matching: string[]) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

const colorStops: string[] = []
// Only the plain colours: gradients are assigned to fillStyle too.
const fills: string[] = []
const context = {
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  createRadialGradient: vi.fn(() => ({
    addColorStop: (_offset: number, color: string) => colorStops.push(color),
  })),
  set fillStyle(value: string) {
    if (typeof value === 'string') fills.push(value)
  },
  get fillStyle() {
    return fills.at(-1) ?? ''
  },
}

let rafQueue: Map<number, FrameRequestCallback>
let rafId: number
let clock: number

function stubRaf() {
  rafQueue = new Map()
  rafId = 0
  clock = 0
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: FrameRequestCallback) => {
      rafId += 1
      rafQueue.set(rafId, cb)
      return rafId
    }),
  )
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => {
      rafQueue.delete(id)
    }),
  )
}

// Runs every callback queued right now (callbacks queued meanwhile wait).
function flushFrame(step = 40) {
  clock += step
  const pending = [...rafQueue.entries()]
  rafQueue.clear()
  act(() => pending.forEach(([, cb]) => cb(clock)))
}

function stubHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  })
}

beforeEach(() => {
  colorStops.length = 0
  fills.length = 0
  Object.values(context).forEach((value) => {
    if (typeof value === 'function' && 'mockClear' in value) value.mockClear()
  })
  stubRaf()
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => context,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext
  stubMatchMedia([])
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.className = ''
  Reflect.deleteProperty(document, 'hidden')
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
    render(<InteractiveBackground style="aurora" />)
    expect(context.clearRect).toHaveBeenCalled()
    expect(context.createRadialGradient).toHaveBeenCalled()
    expect(rafQueue.size).toBe(0)
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
  })

  it('does not schedule continuous frames while the document is hidden', () => {
    stubHidden(true)
    render(<InteractiveBackground style="aurora" />)
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
    expect(context.clearRect).toHaveBeenCalled()
  })

  it('recolors from the CSS variables when the theme class changes', async () => {
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (name: string) => {
        if (name !== '--primary') return ''
        return document.documentElement.classList.contains('dark')
          ? '#112233'
          : '#445566'
      },
    }))
    render(<InteractiveBackground style="aurora" />)
    flushFrame()
    // Light theme: the primary colour is the wash over the page.
    expect(fills.some((c) => c.startsWith('rgba(68, 85, 102'))).toBe(true)
    colorStops.length = 0
    document.documentElement.classList.add('dark')
    await act(async () => {
      await Promise.resolve()
    })
    expect(colorStops.some((c) => c.startsWith('rgba(17, 34, 51'))).toBe(true)
  })

  it('light theme: a faint blue wash over the page with faint spots of light, no colour blobs', () => {
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (name: string) => (name === '--primary' ? '#2563c9' : name === '--support' ? '#38a3ff' : ''),
    }))
    render(<InteractiveBackground style="aurora" />)
    flushFrame()
    expect(fills).toContain('rgba(37, 99, 201, 0.05)')
    expect(colorStops.some((c) => c.startsWith('rgba(255, 255, 255, 0.3)'))).toBe(true)
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, expect.any(Number), expect.any(Number))
    expect(colorStops.length).toBeGreaterThan(0)
    for (const stop of colorStops) expect(stop).toMatch(/^rgba\(255, 255, 255,/)
  })

  it('dark theme: a barely-there tint, the support blobs neutral and no wash', () => {
    document.documentElement.classList.add('dark')
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (name: string) =>
        name === '--primary' ? '#7fd18f' : name === '--support' ? '#a78bfa' : name === '--chart-1' ? '#26292e' : '',
    }))
    render(<InteractiveBackground style="aurora" />)
    flushFrame()
    expect(colorStops.some((c) => c.startsWith('rgba(127, 209, 143, 0.05)'))).toBe(true)
    expect(colorStops.some((c) => c.startsWith('rgba(38, 41, 46, 0.05)'))).toBe(true)
    expect(colorStops.some((c) => c.startsWith('rgba(167, 139, 250'))).toBe(false)
    expect(colorStops.some((c) => c.startsWith('rgba(255, 255, 255'))).toBe(false)
    expect(fills.some((c) => c.startsWith('rgba(127, 209, 143, 0.05)'))).toBe(false)
  })

  it('sizes the aurora backing store at half scale', () => {
    const { container } = render(<InteractiveBackground style="aurora" />)
    const canvas = container.querySelector('canvas')!
    expect(canvas.width).toBe(Math.round(window.innerWidth * 0.5))
    expect(context.setTransform).toHaveBeenCalledWith(0.5, 0, 0, 0.5, 0, 0)
  })

  it('throttles aurora to roughly 30 fps', () => {
    render(<InteractiveBackground style="aurora" />)
    flushFrame(40)
    const drawn = context.clearRect.mock.calls.length
    flushFrame(10)
    expect(context.clearRect.mock.calls.length).toBe(drawn)
    expect(rafQueue.size).toBe(1)
    flushFrame(30)
    expect(context.clearRect.mock.calls.length).toBe(drawn + 1)
  })

  it('eases the pointer pull out instead of snapping when the pointer leaves', () => {
    render(<InteractiveBackground style="pontos" />)
    const radii = () => context.arc.mock.calls.map((c) => c[2] as number)
    act(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 100, clientY: 100 }),
      )
    })
    for (let i = 0; i < 80; i++) flushFrame()
    expect(Math.max(...radii())).toBeGreaterThan(1.2 + 1)
    act(() => {
      document.documentElement.dispatchEvent(new Event('pointerleave'))
    })
    context.arc.mockClear()
    flushFrame()
    expect(Math.max(...radii())).toBeGreaterThan(1.2 + 0.1)
    expect(rafQueue.size).toBe(1)
    for (let i = 0; i < 80; i++) flushFrame()
    context.arc.mockClear()
    flushFrame()
    expect(rafQueue.size).toBe(0)
  })

  it('cleans up listeners and frames on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<InteractiveBackground style="aurora" />)
    const pendingId = [...rafQueue.keys()][0]
    expect(pendingId).toBeGreaterThan(0)
    unmount()
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(pendingId)
    expect(rafQueue.size).toBe(0)
    expect(remove.mock.calls.map((c) => c[0])).toContain('pointermove')
  })
})

describe('stepPull', () => {
  it('moves a fraction toward the goal each step', () => {
    expect(stepPull(0, 1)).toBeCloseTo(0.12)
    expect(stepPull(1, 0)).toBeCloseTo(0.88)
  })

  it('snaps to the goal once within the settle threshold', () => {
    expect(stepPull(0.995, 1)).toBe(1)
    expect(stepPull(0.005, 0)).toBe(0)
  })
})
