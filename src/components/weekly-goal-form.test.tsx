import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WeeklyGoalForm } from '@/components/weekly-goal-form'

describe('WeeklyGoalForm', () => {
  it('submits title and the reference week date', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(<WeeklyGoalForm action={action} />)

    await userEvent.type(screen.getByLabelText(/título/i), 'Correr 3x')
    await userEvent.type(screen.getByLabelText(/semana de/i), '2026-07-29')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    const submitted = action.mock.calls[0][0] as FormData
    expect(submitted.get('title')).toBe('Correr 3x')
    expect(submitted.get('weekOf')).toBe('2026-07-29')
  })

  it('submits recurring when the box is checked', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(<WeeklyGoalForm action={action} />)

    await userEvent.type(screen.getByLabelText(/título/i), 'Academia')
    await userEvent.type(screen.getByLabelText(/semana de/i), '2026-08-17')
    await userEvent.click(screen.getByRole('checkbox', { name: /repetir toda semana/i }))
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    const submitted = action.mock.calls[0][0] as FormData
    expect(submitted.get('recurring')).not.toBeNull()
  })

  it('omits recurring when the box is left unchecked', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(<WeeklyGoalForm action={action} />)

    await userEvent.type(screen.getByLabelText(/título/i), 'Pontual')
    await userEvent.type(screen.getByLabelText(/semana de/i), '2026-08-17')
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    const submitted = action.mock.calls[0][0] as FormData
    expect(submitted.get('recurring')).toBeNull()
  })

  it('starts checked when editing a goal that already recurs', () => {
    render(
      <WeeklyGoalForm
        action={vi.fn()}
        defaultValues={{ title: 'Academia', weekOf: '2026-08-17', recurring: true }}
      />,
    )

    expect(screen.getByRole('checkbox', { name: /repetir toda semana/i })).toBeChecked()
  })
})
