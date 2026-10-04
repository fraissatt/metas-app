import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/ui/input'
import { SmoothCaretInput } from '@/components/ui/smooth-caret-input'

function caret(container: HTMLElement) {
  return container.querySelector('[data-slot="input-caret"]') as HTMLElement | null
}

describe('SmoothCaretInput', () => {
  it('passes props and the ref through to the real input', () => {
    const ref = createRef<HTMLInputElement>()
    render(<SmoothCaretInput ref={ref} name="title" aria-label="Título" defaultValue="Correr" required />)

    const input = screen.getByLabelText('Título')
    expect(input).toHaveAttribute('name', 'title')
    expect(input).toHaveValue('Correr')
    expect(input).toBeRequired()
    expect(ref.current).toBe(input)
  })

  it('hides the native caret and draws its own, decorative one', () => {
    const { container } = render(<SmoothCaretInput aria-label="Título" />)

    expect(screen.getByLabelText('Título')).toHaveClass('caret-transparent')
    expect(caret(container)).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows the caret only while focused', async () => {
    const { container } = render(<SmoothCaretInput aria-label="Título" />)
    expect(caret(container)).toHaveStyle({ opacity: '0' })

    // Motion writes styles on its next frame, hence waitFor.
    await userEvent.click(screen.getByLabelText('Título'))
    await waitFor(() => expect(caret(container)).toHaveStyle({ opacity: '1' }))

    await userEvent.tab()
    await waitFor(() => expect(caret(container)).toHaveStyle({ opacity: '0' }))
  })

  it('hides the caret while text is selected', async () => {
    const { container } = render(<SmoothCaretInput aria-label="Título" defaultValue="Correr" />)
    const input = screen.getByLabelText('Título') as HTMLInputElement

    await userEvent.click(input)
    await waitFor(() => expect(caret(container)).toHaveStyle({ opacity: '1' }))

    input.setSelectionRange(0, 3)
    fireEvent.select(input)

    await waitFor(() => expect(caret(container)).toHaveStyle({ opacity: '0' }))
  })

  it('still calls the caller’s focus and blur handlers', async () => {
    const events: string[] = []
    render(
      <SmoothCaretInput aria-label="Título" onFocus={() => events.push('focus')} onBlur={() => events.push('blur')} />,
    )

    await userEvent.click(screen.getByLabelText('Título'))
    await userEvent.tab()

    expect(events).toEqual(['focus', 'blur'])
  })
})

describe('Input', () => {
  it('uses the smooth caret for text fields', () => {
    const { container } = render(<Input aria-label="Título" />)
    expect(caret(container)).not.toBeNull()
  })

  it('keeps date and other non-text fields native', () => {
    const { container } = render(<Input aria-label="Data" type="date" />)
    expect(caret(container)).toBeNull()
    expect(screen.getByLabelText('Data')).not.toHaveClass('caret-transparent')
  })
})
