'use client'

import type { CSSProperties } from 'react'
import { DemoGuard, DemoStateProvider, useDemoState, useHasDemoState } from '@/components/landing-demo-state'
import { HINT, ObjectiveView, TodayView, WeekView } from '@/components/landing-demo-views'
import { Button } from '@/components/ui/button'
import type { LandingDemoData } from '@/lib/landing-demo'

export type DemoStep = 0 | 1 | 2

const VIEWS = ['objective', 'week', 'today'] as const

function Panel({ data, step }: { data: LandingDemoData; step: DemoStep }) {
  const { goals, ticked, toggle, reset } = useDemoState()

  return (
    <div role="region" aria-label="Demonstração interativa" className="flex flex-col gap-3">
      <DemoGuard className="[&_a]:cursor-default">
        {/* The three views share one grid cell: the parent sets --v0..--v2 from the scroll and they fade in turn. */}
        <div className="grid">
          {VIEWS.map((name, index) => (
            <div
              key={name}
              data-view={name}
              data-active={step === index ? '' : undefined}
              inert={step !== index}
              aria-hidden={step !== index ? true : undefined}
              className="landing-layer col-start-1 row-start-1"
              style={{ '--w': `var(--v${index}, ${step === index ? 1 : 0})` } as CSSProperties}
            >
              {index === 0 && <ObjectiveView data={data} goals={goals} />}
              {index === 1 && <WeekView goals={goals} />}
              {index === 2 && <TodayView today={data.today} goals={goals} onToggle={toggle} />}
            </div>
          ))}
        </div>
      </DemoGuard>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{step === 2 && !ticked ? HINT : ''}</p>
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          Recomeçar
        </Button>
      </div>
    </div>
  )
}

/**
 * The demo as one panel with the three views stacked (desktop). It brings its
 * own tasks unless a `DemoStateProvider` above already shares them with other views.
 */
export function LandingDemo({ data, step }: { data: LandingDemoData; step: DemoStep }) {
  const shared = useHasDemoState()
  if (shared) return <Panel data={data} step={step} />
  return (
    <DemoStateProvider data={data}>
      <Panel data={data} step={step} />
    </DemoStateProvider>
  )
}
