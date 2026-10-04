'use client'

import { createContext, useContext, useRef, useState } from 'react'
import { InteractiveBackground } from '@/components/interactive-background'
import type { BackgroundStyle } from '@/lib/background-options'

type BackgroundContextValue = {
  style: BackgroundStyle
  setStyle: (style: BackgroundStyle) => void
}

const BackgroundContext = createContext<BackgroundContextValue | null>(null)

export function useBackground(): BackgroundContextValue {
  const value = useContext(BackgroundContext)
  if (!value) throw new Error('useBackground must be used inside BackgroundProvider')
  return value
}

export function BackgroundProvider({
  initial,
  onChange,
  children,
}: {
  initial: BackgroundStyle
  onChange: (style: BackgroundStyle) => Promise<void>
  children: React.ReactNode
}) {
  const [style, setState] = useState<BackgroundStyle>(initial)
  const confirmed = useRef<BackgroundStyle>(initial)
  const counter = useRef(0)
  const queue = useRef<Promise<void>>(Promise.resolve())

  function setStyle(next: BackgroundStyle) {
    const id = ++counter.current
    setState(next)
    queue.current = queue.current.then(async () => {
      try {
        await onChange(next)
        confirmed.current = next
      } catch {
        // Only revert if this is still the latest request
        if (id === counter.current) setState(confirmed.current)
      }
    })
  }

  return (
    <BackgroundContext value={{ style, setStyle }}>
      <InteractiveBackground style={style} />
      {children}
    </BackgroundContext>
  )
}
