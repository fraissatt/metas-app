import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ObjectiveForm } from '@/components/objective-form'

describe('ObjectiveForm', () => {
  it('submits the entered title and start date', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(<ObjectiveForm action={action} />)

    await userEvent.type(screen.getByLabelText(/título/i), 'Aprender React')
    await userEvent.type(screen.getByLabelText(/início/i), '2026-07-29')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    expect(action).toHaveBeenCalledOnce()
    const submitted = action.mock.calls[0][0] as FormData
    expect(submitted.get('title')).toBe('Aprender React')
    expect(submitted.get('startDate')).toBe('2026-07-29')
  })

  it('pre-fills fields from defaultValues', () => {
    render(
      <ObjectiveForm
        action={vi.fn()}
        defaultValues={{ title: 'Existing', startDate: '2026-01-01' }}
      />,
    )

    expect(screen.getByLabelText(/título/i)).toHaveValue('Existing')
  })
})
