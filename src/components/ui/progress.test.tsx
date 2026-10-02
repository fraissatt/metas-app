import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Progress } from '@/components/ui/progress'

const GLOW_CLASS = 'data-complete:shadow-[0_0_8px_var(--glow)]'

function getTrack(container: HTMLElement) {
  const track = container.querySelector('[data-slot="progress-track"]')
  if (!track) throw new Error('progress track not rendered')
  return track
}

// The track clips its children (overflow-x-hidden, h-1), so the glow has to be
// painted by the track itself or it would never be seen.
describe('Progress', () => {
  it('glows on the track once the value reaches 100', () => {
    const { container } = render(<Progress value={100} />)
    const track = getTrack(container)

    expect(track).toHaveAttribute('data-complete')
    expect(track.className).toContain(GLOW_CLASS)
  })

  it('does not mark the track complete while progress is partial', () => {
    const { container } = render(<Progress value={40} />)

    expect(getTrack(container)).not.toHaveAttribute('data-complete')
  })
})
