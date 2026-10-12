'use client'

import { CircleHelp } from 'lucide-react'
import { useTour } from '@/components/tour-provider'

export function HelpButton() {
  const { openTour } = useTour()

  return (
    <button
      type="button"
      onClick={openTour}
      aria-label="Ver tour"
      title="Ver tour"
      className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CircleHelp className="size-5" aria-hidden="true" />
    </button>
  )
}
