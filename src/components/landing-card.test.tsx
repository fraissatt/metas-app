import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Target } from 'lucide-react'
import { LandingCard } from '@/components/landing-card'

describe('LandingCard', () => {
  it('renders the title as a heading and the line of text, inside a list item', () => {
    render(
      <ul>
        <LandingCard icon={Target} title="Objetivos" text="O destino, com prazo e progresso" color="green" index={0} />
      </ul>,
    )
    expect(screen.getByRole('listitem')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Objetivos' })).toBeInTheDocument()
    expect(screen.getByText('O destino, com prazo e progresso')).toBeInTheDocument()
  })

  it('is not interactive and hides the decorative icon from assistive tech', () => {
    const { container } = render(
      <ul>
        <LandingCard icon={Target} title="Objetivos" text="O destino" color="blue" index={2} />
      </ul>,
    )
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('carries its colour and entrance order as CSS variables', () => {
    render(
      <ul>
        <LandingCard icon={Target} title="Objetivos" text="O destino" color="pink" index={3} />
      </ul>,
    )
    const item = screen.getByRole('listitem')
    expect(item.style.getPropertyValue('--card-color')).toBe('var(--lp-pink)')
    expect(item.style.getPropertyValue('--i')).toBe('3')
  })
})
