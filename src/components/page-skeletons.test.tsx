import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ObjectiveDetailSkeleton, ObjectivesSkeleton, PageSkeleton, TodaySkeleton } from './page-skeletons'

describe.each([
  ['Hoje', TodaySkeleton],
  ['Objetivos', ObjectivesSkeleton],
  ['objetivo', ObjectiveDetailSkeleton],
  ['genérico', PageSkeleton],
])('%s skeleton', (_, Skeleton) => {
  it('announces loading once and hides the placeholder shapes', () => {
    const { container } = render(<Skeleton />)
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    expect(container.querySelector('main')).toHaveAttribute('aria-busy', 'true')
    const shapes = container.querySelector('[aria-hidden="true"]')
    expect(shapes?.querySelectorAll('[data-bone]').length).toBeGreaterThan(2)
  })

  it('stops pulsing under reduced motion', () => {
    const { container } = render(<Skeleton />)
    expect(container.querySelector('.animate-pulse')).toHaveClass('motion-reduce:animate-none')
  })
})

it('the objective skeleton has a place for the Ritmo chart', () => {
  const { container } = render(<ObjectiveDetailSkeleton />)
  expect(container.querySelector('[data-skeleton="ritmo"]')).not.toBeNull()
})
