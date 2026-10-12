import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HelpButton } from '@/components/help-button'
import { TourProvider } from '@/components/tour-provider'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

const setup = () =>
  render(
    <TourProvider initialSeen canOpen={false} onSeen={vi.fn(async () => {})}>
      <HelpButton />
    </TourProvider>,
  )

describe('HelpButton', () => {
  it('is a button named "Ver tour"', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Ver tour' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the tour on the first step', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Ver tour' }))
    expect(await screen.findByRole('dialog', { name: 'Objetivos' })).toBeInTheDocument()
  })
})
