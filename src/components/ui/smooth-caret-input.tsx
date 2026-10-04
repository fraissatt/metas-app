"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react"

import { cn } from "@/lib/utils"

// Tuned once and fixed: the original demo exposed these on a dev-only panel.
const SPRING = { stiffness: 500, damping: 30, mass: 0.5 }
// With reduced motion the caret jumps instead of gliding.
const INSTANT = { stiffness: 10000, damping: 100, mass: 0.1 }

// Read lazily: `navigator` does not exist while the server renders.
function passwordChar() {
  return /firefox|fxios/i.test(navigator.userAgent) ? "●" : "•"
}

function caretIndex(input: HTMLInputElement) {
  const start = input.selectionStart ?? 0
  const end = input.selectionEnd ?? 0
  if (start === end) return start
  return input.selectionDirection === "backward" ? start : end
}

type SmoothCaretInputProps = React.ComponentProps<"input"> & {
  wrapperClassName?: string
}

/**
 * A text input whose caret glides to its new position instead of jumping.
 * The native caret is hidden; a decorative one is positioned by measuring the
 * text before the selection in an invisible span with the input's font.
 * Value handling is untouched, so it works controlled or uncontrolled.
 */
function SmoothCaretInput({
  className,
  wrapperClassName,
  style,
  onFocus,
  onBlur,
  ref,
  ...props
}: SmoothCaretInputProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const measureRef = React.useRef<HTMLSpanElement>(null)
  const reduceMotion = useReducedMotion()

  const caretX = useMotionValue(0)
  const caretHeight = useMotionValue(0)
  const caretOpacity = useMotionValue(0)
  const springX = useSpring(caretX, reduceMotion ? INSTANT : SPRING)

  const setRefs = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  const update = React.useCallback(() => {
    const input = inputRef.current
    const span = measureRef.current
    if (!input || !span) return

    const styles = window.getComputedStyle(input)
    span.style.font = `${styles.fontStyle} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`
    span.style.letterSpacing = styles.letterSpacing

    const index = caretIndex(input)
    const before =
      input.type === "password" ? passwordChar().repeat(index) : input.value.slice(0, index)
    span.textContent = before

    const borderLeft = parseFloat(styles.borderLeftWidth) || 0
    const borderRight = parseFloat(styles.borderRightWidth) || 0
    const paddingLeft = parseFloat(styles.paddingLeft) || 0
    const paddingRight = parseFloat(styles.paddingRight) || 0
    const start = borderLeft + paddingLeft
    const end = input.offsetWidth - borderRight - paddingRight
    // The browser scrolls long values itself; follow its scroll offset.
    const position = start + (before ? span.offsetWidth : 0) - input.scrollLeft

    caretX.set(Math.min(position, end))
    caretHeight.set((parseFloat(styles.fontSize) || 16) * 1.15)

    const hasSelection = input.selectionStart !== input.selectionEnd
    const outOfView = position < start - 1 || position > end + 1
    caretOpacity.set(hasSelection || outOfView ? 0 : 1)
  }, [caretHeight, caretOpacity, caretX])

  React.useEffect(() => {
    const input = inputRef.current
    if (!input) return

    const ifFocused = () => {
      if (document.activeElement === input) update()
    }
    // Typing, clicks and arrow keys all move the selection; the browser reports
    // it after its own layout, so measure on the next frame.
    const nextFrame = () => requestAnimationFrame(ifFocused)

    const events = ["input", "select", "keyup", "click", "scroll"] as const
    events.forEach((name) => input.addEventListener(name, nextFrame))
    document.addEventListener("selectionchange", nextFrame)
    document.fonts?.ready.then(ifFocused)
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(ifFocused)
    observer?.observe(input)

    return () => {
      events.forEach((name) => input.removeEventListener(name, nextFrame))
      document.removeEventListener("selectionchange", nextFrame)
      observer?.disconnect()
    }
  }, [update])

  return (
    <div data-slot="input-wrapper" className={cn("relative w-full min-w-0", wrapperClassName)}>
      <InputPrimitive
        {...props}
        ref={setRefs}
        className={cn(className, "caret-transparent")}
        style={style}
        onFocus={(event: React.FocusEvent<HTMLInputElement>) => {
          update()
          onFocus?.(event)
        }}
        onSelect={(event: React.SyntheticEvent<HTMLInputElement>) => {
          update()
          props.onSelect?.(event)
        }}
        onBlur={(event: React.FocusEvent<HTMLInputElement>) => {
          caretOpacity.set(0)
          onBlur?.(event)
        }}
      />
      <span
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute top-0 left-0 whitespace-pre"
      />
      <motion.span
        data-slot="input-caret"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-0 w-0.5 -translate-y-1/2 rounded-full bg-primary"
        style={{ x: springX, height: caretHeight, opacity: caretOpacity }}
      />
    </div>
  )
}

export { SmoothCaretInput }
