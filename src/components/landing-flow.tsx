'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { CardProgressProvider } from '@/components/landing-card-progress'
import { LandingDemo, type DemoStep } from '@/components/landing-demo'
import { DemoStateProvider } from '@/components/landing-demo-state'
import { DemoCard } from '@/components/landing-demo-views'
import { LandingStep } from '@/components/landing-step'
import { STEPS } from '@/components/landing-steps'
import { formatDate } from '@/lib/dates'
import type { LandingDemoData } from '@/lib/landing-demo'
import { cardProgress, createCardProgress, type CardProgressStore } from '@/lib/card-progress'
import { scrollProgress, viewWeights } from '@/lib/scroll-progress'

// Where the reader's eye is: the middle of the window on desktop; on phones the
// sticky demo covers the top half, so it is lower, just under the demo.
const DESKTOP_REFERENCE = 0.5
const PHONE_REFERENCE = 0.72

function practiceLines(data: LandingDemoData): string[] {
  const { objective, goals } = data
  const goal = goals[0]
  const task = goal.dailyTasks.find((candidate) => !candidate.completed)?.title ?? goal.dailyTasks[0].title
  return [
    objective.targetDate ? `${objective.title}, até ${formatDate(objective.targetDate)}` : objective.title,
    goal.title,
    `${task}, hoje`,
  ]
}

// The phone cards: how far each has entered the window, for the numbers and bars inside it.
function updateCards(node: HTMLElement, store: CardProgressStore) {
  node.querySelectorAll<HTMLElement>('[data-card]').forEach((card) => {
    store.set(Number(card.dataset.card), cardProgress(card.getBoundingClientRect().top, window.innerHeight))
  })
}

const INITIAL_WEIGHTS = { '--p': 0, '--v0': 1, '--v1': 0, '--v2': 0 } as CSSProperties

export function LandingFlow({ data }: { data: LandingDemoData }) {
  const [active, setActive] = useState<DemoStep>(0)
  const grid = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLLIElement | null)[]>([])
  const practice = practiceLines(data)
  const [store] = useState(() => createCardProgress(STEPS.length))

  // Before the first paint, so a card below the fold never flashes its final numbers.
  useLayoutEffect(() => {
    if (grid.current) updateCards(grid.current, store)
  }, [store])

  useEffect(() => {
    let frame = 0
    let scheduled = false

    function update() {
      scheduled = false
      const node = grid.current
      if (!node) return
      updateCards(node, store)
      const centers = items.current.map((item) => {
        const box = item?.getBoundingClientRect()
        return box ? box.top + box.height / 2 : Number.NaN
      })
      // No layout (a bare DOM, or hidden): leave the first step showing.
      if (centers.some((center, i) => Number.isNaN(center) || (i > 0 && center <= centers[i - 1]))) return

      const desktop = typeof matchMedia === 'function' && matchMedia('(min-width: 1024px)').matches
      const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
      const progress = scrollProgress(centers, window.innerHeight * (desktop ? DESKTOP_REFERENCE : PHONE_REFERENCE))

      // Written straight to the DOM: this runs every frame while scrolling, and a re-render each time is not needed.
      node.style.setProperty('--p', String(Math.round(progress * 1000) / 1000))
      viewWeights(progress, STEPS.length, reduced).forEach((weight, index) => {
        node.style.setProperty(`--v${index}`, String(weight))
      })
      const next = Math.min(STEPS.length - 1, Math.max(0, Math.round(progress))) as DemoStep
      setActive((current) => (current === next ? current : next))
    }

    const schedule = () => {
      if (scheduled) return
      scheduled = true
      frame = requestAnimationFrame(update)
    }

    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (scheduled) cancelAnimationFrame(frame)
    }
  }, [store])

  return (
    <DemoStateProvider data={data}>
      <CardProgressProvider value={store}>
        <div ref={grid} style={INITIAL_WEIGHTS} className="grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-12">
          {/* The sticky box is a direct child of the grid, so it can travel the whole height of the steps. */}
          <div className="sticky top-20 z-10 hidden max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-border bg-background/90 p-3 backdrop-blur lg:order-last lg:block">
            <LandingDemo data={data} step={active} />
          </div>
          <ol aria-label="Como funciona" className="flex flex-col">
            {STEPS.map((step, index) => (
              <LandingStep
                key={step.title}
                ref={(element) => {
                  items.current[index] = element
                }}
                index={index}
                {...step}
                practice={practice[index]}
                active={active === index}
                last={index === STEPS.length - 1}
                className="lg:min-h-[50vh]"
              >
                <DemoCard index={index as 0 | 1 | 2} data={data} />
              </LandingStep>
            ))}
          </ol>
          <p className="sr-only" aria-live="polite">
            Passo {active + 1} de {STEPS.length}: {STEPS[active].title}
          </p>
        </div>
      </CardProgressProvider>
    </DemoStateProvider>
  )
}
