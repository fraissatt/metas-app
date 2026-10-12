'use client'

import { useEffect, useRef, useState } from 'react'
import { LandingDemo, type DemoStep } from '@/components/landing-demo'
import { LandingStep } from '@/components/landing-step'
import { STEPS } from '@/components/landing-steps'
import type { LandingDemoData } from '@/lib/landing-demo'

export function LandingFlow({ data }: { data: LandingDemoData }) {
  const [active, setActive] = useState<DemoStep>(0)
  const items = useRef<(HTMLLIElement | null)[]>([])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    // A thin band around the middle of the window: the step crossing it is the one being read.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = items.current.indexOf(entry.target as HTMLLIElement)
          if (index >= 0) setActive(index as DemoStep)
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    items.current.forEach((item) => item && observer.observe(item))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-12">
      <div className="order-first lg:sticky lg:top-20 lg:order-last">
        <div className="sticky top-14 z-10 max-h-[45vh] overflow-y-auto rounded-xl border border-border bg-background/90 p-3 backdrop-blur lg:static lg:max-h-[calc(100vh-7rem)]">
          <LandingDemo data={data} step={active} />
        </div>
      </div>
      <ol aria-label="Como funciona" className="flex flex-col">
        {STEPS.map((step, index) => (
          <LandingStep
            key={step.title}
            ref={(element) => {
              items.current[index] = element
            }}
            number={index + 1}
            {...step}
            active={active === index}
            last={index === STEPS.length - 1}
            className="min-h-[35vh] lg:min-h-[60vh]"
          />
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">
        Passo {active + 1} de {STEPS.length}: {STEPS[active].title}
      </p>
    </div>
  )
}
