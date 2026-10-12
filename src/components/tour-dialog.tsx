'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TOUR_STEPS } from '@/components/tour-steps'

export function TourDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [index, setIndex] = useState(0)
  // Focus the main action when the dialog opens: Pular is first in the DOM, so
  // the default would make Enter skip the whole tour.
  const nextRef = useRef<HTMLButtonElement>(null)
  const step = TOUR_STEPS[index]
  const Icon = step.icon
  const isLast = index === TOUR_STEPS.length - 1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} initialFocus={nextRef}>
        <div
          key={step.id}
          className="tour-step flex flex-col gap-3"
          style={{ '--card-color': `var(--lp-${step.color})` } as CSSProperties}
        >
          <span
            className="flex size-10 items-center justify-center rounded-lg"
            style={{ color: 'var(--card-color)', background: 'color-mix(in oklab, var(--card-color) 16%, transparent)' }}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <DialogHeader>
            <DialogTitle>{step.title}</DialogTitle>
            <DialogDescription>{step.text}</DialogDescription>
          </DialogHeader>
        </div>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="flex gap-1">
            {TOUR_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`size-1.5 rounded-full ${i === index ? 'bg-foreground' : 'bg-muted-foreground/40'}`}
              />
            ))}
          </span>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {index + 1} de {TOUR_STEPS.length}
          </p>
        </div>
        <DialogFooter className="items-center">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="sm:mr-auto">
            Pular
          </Button>
          {index > 0 && (
            <Button variant="outline" onClick={() => setIndex(index - 1)}>
              Voltar
            </Button>
          )}
          <Button ref={nextRef} onClick={() => (isLast ? onOpenChange(false) : setIndex(index + 1))}>
            {isLast ? 'Começar' : 'Próximo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
