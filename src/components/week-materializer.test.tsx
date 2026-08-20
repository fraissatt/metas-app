import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { WeekMaterializer } from '@/components/week-materializer'

describe('WeekMaterializer', () => {
  it('calls onMaterialize once on mount', () => {
    const onMaterialize = vi.fn().mockResolvedValue(undefined)

    render(<WeekMaterializer onMaterialize={onMaterialize} />)

    expect(onMaterialize).toHaveBeenCalledTimes(1)
  })

  it('does not call it again when the parent re-renders', () => {
    const onMaterialize = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<WeekMaterializer onMaterialize={onMaterialize} />)

    rerender(<WeekMaterializer onMaterialize={onMaterialize} />)

    expect(onMaterialize).toHaveBeenCalledTimes(1)
  })

  it('renders nothing', () => {
    const { container } = render(<WeekMaterializer onMaterialize={vi.fn()} />)

    expect(container).toBeEmptyDOMElement()
  })
})
