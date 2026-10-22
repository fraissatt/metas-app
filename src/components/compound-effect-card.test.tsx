import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompoundEffectCard } from '@/components/compound-effect-card'

describe('CompoundEffectCard', () => {
  it('invites a user with no day done yet', () => {
    render(<CompoundEffectCard daysDone={0} />)
    expect(screen.getByText('Cada dia feito soma 1%. Em um ano, isso vira 37×.')).toBeInTheDocument()
  })

  it('shows what the days done are worth', () => {
    render(<CompoundEffectCard daysDone={70} />)
    expect(screen.getByRole('region', { name: 'Efeito composto' })).toBeInTheDocument()
    expect(screen.getByText('1% melhor a cada dia feito')).toBeInTheDocument()
    expect(screen.getByText('Seus 70 dias feitos já valem 2,0×')).toBeInTheDocument()
  })

  it('uses the singular for one day', () => {
    render(<CompoundEffectCard daysDone={1} />)
    expect(screen.getByText('Seu 1 dia feito já vale 1,0×')).toBeInTheDocument()
  })

  it('drops its own frame when it sits in a panel, and keeps it by default', () => {
    const { rerender } = render(<CompoundEffectCard daysDone={3} flat />)
    const region = () => screen.getByRole('region', { name: 'Efeito composto' })
    expect(region()).not.toHaveClass('rounded-lg')
    expect(region()).not.toHaveClass('border')

    rerender(<CompoundEffectCard daysDone={3} />)
    expect(region()).toHaveClass('rounded-lg', 'border')
  })
})
