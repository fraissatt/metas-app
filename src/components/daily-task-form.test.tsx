import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DailyTaskForm } from '@/components/daily-task-form'

describe('DailyTaskForm', () => {
  it('submits title and date', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(<DailyTaskForm action={action} />)

    await userEvent.type(screen.getByLabelText(/título/i), 'Correr 5km')
    await userEvent.type(screen.getByLabelText(/data/i), '2026-07-29')
    await userEvent.click(screen.getByRole('button', { name: /adicionar/i }))

    const submitted = action.mock.calls[0][0] as FormData
    expect(submitted.get('title')).toBe('Correr 5km')
    expect(submitted.get('date')).toBe('2026-07-29')
  })

  it('pre-fills fields from defaultValues', () => {
    render(
      <DailyTaskForm action={vi.fn()} defaultValues={{ title: 'Existing', date: '2026-07-29' }} />,
    )

    expect(screen.getByLabelText(/título/i)).toHaveValue('Existing')
    expect(screen.getByLabelText(/data/i)).toHaveValue('2026-07-29')
  })
})
