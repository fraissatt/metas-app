import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ObjectiveStatusButton } from '@/components/objective-status-button'

describe('ObjectiveStatusButton', () => {
  it('offers to complete an active objective', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined)
    const onReopen = vi.fn().mockResolvedValue(undefined)
    render(<ObjectiveStatusButton status="ACTIVE" onComplete={onComplete} onReopen={onReopen} />)

    await userEvent.click(screen.getByRole('button', { name: /concluir objetivo/i }))

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onReopen).not.toHaveBeenCalled()
  })

  it('offers to reopen a completed objective', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined)
    const onReopen = vi.fn().mockResolvedValue(undefined)
    render(<ObjectiveStatusButton status="COMPLETED" onComplete={onComplete} onReopen={onReopen} />)

    await userEvent.click(screen.getByRole('button', { name: /reabrir/i }))

    expect(onReopen).toHaveBeenCalledTimes(1)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('says a quiet word after the objective is completed, and nothing after reopening', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(
      <ObjectiveStatusButton status="ACTIVE" title="Correr 10 km" onComplete={onComplete} onReopen={vi.fn()} />,
    )
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    await userEvent.click(screen.getByRole('button', { name: /concluir objetivo/i }))
    expect(await screen.findByText('Objetivo concluído')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Você chegou em “Correr 10 km”.')

    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    rerender(
      <ObjectiveStatusButton
        status="COMPLETED"
        title="Correr 10 km"
        onComplete={onComplete}
        onReopen={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /reabrir/i }))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
