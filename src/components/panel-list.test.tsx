import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PanelList } from '@/components/panel-list'

describe('PanelList', () => {
  it('draws one panel around its rows, with a hairline between them', () => {
    render(
      <PanelList>
        <div>primeira</div>
        <div>segunda</div>
      </PanelList>,
    )

    const panel = screen.getByText('primeira').parentElement
    expect(panel).toHaveClass('divide-y', 'divide-border', 'rounded-lg', 'border', 'overflow-hidden')
    expect(panel).toContainElement(screen.getByText('segunda'))
  })

  it('renders nothing when there are no rows', () => {
    const { container } = render(<PanelList>{null}</PanelList>)

    expect(container).toBeEmptyDOMElement()
  })
})
