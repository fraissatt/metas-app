import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskToggle } from '@/components/task-toggle'

describe('TaskToggle', () => {
  it('calls the action with the task id when checked', async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(<TaskToggle taskId="task-1" completed={false} action={action} />)

    await userEvent.click(screen.getByRole('checkbox'))

    expect(action).toHaveBeenCalledWith('task-1')
  })

  it('renders as checked when completed is true', () => {
    render(<TaskToggle taskId="task-1" completed action={vi.fn()} />)

    expect(screen.getByRole('checkbox')).toBeChecked()
  })
})
