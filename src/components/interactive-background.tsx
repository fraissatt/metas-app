'use client'

import { useEffect, useRef } from 'react'
import type { BackgroundStyle } from '@/lib/background-options'

type Rgb = [number, number, number]

const FALLBACK_PRIMARY: Rgb = [57, 255, 20]
const FALLBACK_SUPPORT: Rgb = [167, 139, 250]
const FALLBACK_NEUTRAL: Rgb = [42, 48, 60]

const MAX_DPR = 2
const EASE = 0.12
const SETTLE_DISTANCE = 0.5

const AURORA_BLOBS = [
  { x: 0.25, y: 0.35, tone: 'primary' },
  { x: 0.75, y: 0.65, tone: 'support' },
  { x: 0.55, y: 0.15, tone: 'primary' },
  { x: 0.15, y: 0.85, tone: 'support' },
] as const
const AURORA_RADIUS = 0.35
const AURORA_ALPHA_DARK = 0.18
const AURORA_ALPHA_LIGHT = 0.14
const AURORA_DRIFT_X = 0.08
const AURORA_DRIFT_Y = 0.1
const AURORA_DRIFT_SPEED = 0.00012
const AURORA_PULL = 0.2

const DOT_SPACING = 24
const DOT_RADIUS = 1.2
const DOT_ALPHA = 0.6
const DOT_INFLUENCE = 140
const DOT_GROWTH = 1.6
const DOT_PUSH = 8

const HEX_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

export function hexToRgb(value: string): Rgb | null {
  const match = HEX_PATTERN.exec(value.trim())
  if (!match) return null
  return [
    parseInt(match[1], 16),
    parseInt(match[2], 16),
    parseInt(match[3], 16),
  ]
}

interface Palette {
  primary: Rgb
  support: Rgb
  neutral: Rgb
  isDark: boolean
}

function readColors(): Palette {
  const root = document.documentElement
  const styles = getComputedStyle(root)
  const read = (name: string, fallback: Rgb) =>
    hexToRgb(styles.getPropertyValue(name)) ?? fallback
  return {
    primary: read('--primary', FALLBACK_PRIMARY),
    support: read('--support', FALLBACK_SUPPORT),
    neutral: read('--chart-1', FALLBACK_NEUTRAL),
    isDark: root.classList.contains('dark'),
  }
}

function rgba([r, g, b]: Rgb, alpha: number) {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

interface Point {
  x: number
  y: number
}

function drawAurora(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  palette: Palette,
  pointer: Point | null,
) {
  const radius = Math.max(width, height) * AURORA_RADIUS
  const alpha = palette.isDark ? AURORA_ALPHA_DARK : AURORA_ALPHA_LIGHT
  AURORA_BLOBS.forEach((blob, index) => {
    const phase = time * AURORA_DRIFT_SPEED + index * 1.7
    let x = (blob.x + Math.sin(phase) * AURORA_DRIFT_X) * width
    let y = (blob.y + Math.cos(phase * 0.9) * AURORA_DRIFT_Y) * height
    if (pointer) {
      x += (pointer.x - x) * AURORA_PULL
      y += (pointer.y - y) * AURORA_PULL
    }
    const color = blob.tone === 'primary' ? palette.primary : palette.support
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, rgba(color, alpha))
    gradient.addColorStop(1, rgba(color, 0))
    ctx.fillStyle = gradient
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  })
}

function drawDots(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: Palette,
  pointer: Point | null,
) {
  const neutral = rgba(palette.neutral, DOT_ALPHA)
  for (let x = DOT_SPACING / 2; x < width; x += DOT_SPACING) {
    for (let y = DOT_SPACING / 2; y < height; y += DOT_SPACING) {
      let dx = x
      let dy = y
      let radius = DOT_RADIUS
      let fill = neutral
      if (pointer) {
        const ox = x - pointer.x
        const oy = y - pointer.y
        const distance = Math.hypot(ox, oy)
        if (distance < DOT_INFLUENCE) {
          const f = 1 - distance / DOT_INFLUENCE
          if (distance > 0) {
            dx += (ox / distance) * DOT_PUSH * f
            dy += (oy / distance) * DOT_PUSH * f
          }
          radius += DOT_GROWTH * f
          fill = rgba(palette.primary, 0.25 + 0.75 * f)
        }
      }
      ctx.beginPath()
      ctx.arc(dx, dy, radius, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
    }
  }
}

export function InteractiveBackground({ style }: { style: BackgroundStyle }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || style === 'nenhum') return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const root = document.documentElement
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const touch = window.matchMedia('(hover: none)')

    let palette = readColors()
    let isStatic = reduce.matches || touch.matches
    let width = 0
    let height = 0
    let target: Point | null = null
    let eased: Point | null = null
    let frame = 0

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const isSettled = () =>
      !target ||
      !eased ||
      Math.hypot(target.x - eased.x, target.y - eased.y) < SETTLE_DISTANCE

    const draw = (time: number) => {
      if (isStatic) {
        eased = null
      } else if (target) {
        eased = eased
          ? {
              x: eased.x + (target.x - eased.x) * EASE,
              y: eased.y + (target.y - eased.y) * EASE,
            }
          : { ...target }
      } else {
        eased = null
      }
      ctx.clearRect(0, 0, width, height)
      if (style === 'aurora') {
        drawAurora(ctx, width, height, isStatic ? 0 : time, palette, eased)
      } else {
        drawDots(ctx, width, height, palette, eased)
      }
    }

    const shouldContinue = () =>
      !document.hidden &&
      !isStatic &&
      (style === 'aurora' || !isSettled())

    const tick = (time: number) => {
      frame = 0
      draw(time)
      if (shouldContinue()) frame = requestAnimationFrame(tick)
    }

    const kick = () => {
      if (frame || document.hidden || isStatic) return
      frame = requestAnimationFrame(tick)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (isStatic) return
      target = { x: event.clientX, y: event.clientY }
      kick()
    }
    const onPointerLeave = () => {
      target = null
      kick()
    }
    const onVisibility = () => {
      if (!document.hidden) kick()
    }
    const onResize = () => {
      size()
      draw(performance.now())
    }
    const onMediaChange = () => {
      isStatic = reduce.matches || touch.matches
      if (isStatic) {
        cancelAnimationFrame(frame)
        frame = 0
        draw(0)
      } else {
        kick()
      }
    }
    const observer = new MutationObserver(() => {
      palette = readColors()
      draw(performance.now())
    })

    size()
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('resize', onResize)
    root.addEventListener('pointerleave', onPointerLeave)
    document.addEventListener('visibilitychange', onVisibility)
    reduce.addEventListener('change', onMediaChange)
    touch.addEventListener('change', onMediaChange)

    if (isStatic) {
      draw(0)
    } else {
      frame = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('resize', onResize)
      root.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      reduce.removeEventListener('change', onMediaChange)
      touch.removeEventListener('change', onMediaChange)
    }
  }, [style])

  if (style === 'nenhum') return null
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  )
}
