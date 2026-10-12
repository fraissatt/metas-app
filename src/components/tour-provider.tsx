'use client'

import { createContext, useContext, useState } from 'react'
import { usePathname } from 'next/navigation'
import { TourDialog } from '@/components/tour-dialog'

// Pages where the tour does not open by itself (the quiz is its own onboarding).
const NO_AUTO_OPEN = ['/quiz']

type TourContextValue = { openTour: () => void }

const TourContext = createContext<TourContextValue | null>(null)

export function useTour(): TourContextValue {
  const value = useContext(TourContext)
  if (!value) throw new Error('useTour must be used inside TourProvider')
  return value
}

export function TourProvider({
  initialSeen,
  canOpen,
  onSeen,
  children,
}: {
  initialSeen: boolean
  canOpen: boolean
  onSeen: () => Promise<void>
  children: React.ReactNode
}) {
  const pathname = usePathname() ?? ''
  const [seen, setSeen] = useState(initialSeen)
  const [manualOpen, setManualOpen] = useState(false)
  // A new run of the dialog starts on its first step.
  const [run, setRun] = useState(0)

  const autoOpen = canOpen && !seen && !NO_AUTO_OPEN.includes(pathname)

  function handleOpenChange(open: boolean) {
    if (open) return
    setManualOpen(false)
    if (!seen) {
      setSeen(true)
      // A failed save only means the tour may open once more next visit.
      onSeen().catch(() => {})
    }
  }

  function openTour() {
    setRun((current) => current + 1)
    setManualOpen(true)
  }

  return (
    <TourContext value={{ openTour }}>
      {children}
      <TourDialog key={run} open={autoOpen || manualOpen} onOpenChange={handleOpenChange} />
    </TourContext>
  )
}
