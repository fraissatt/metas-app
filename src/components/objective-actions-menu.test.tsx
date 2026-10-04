import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ObjectiveActionsMenu } from '@/components/objective-actions-menu'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

describe('ObjectiveActionsMenu', () => {
  it('offers Editar and Excluir… from a labeled trigger', async () => {
    render(<ObjectiveActionsMenu objectiveId="o1" onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ações do objetivo' }))

    expect(await screen.findByRole('menuitem', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Excluir…' })).toBeInTheDocument()
  })

  it('goes to the edit page from Editar', async () => {
    render(<ObjectiveActionsMenu objectiveId="o1" onDelete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ações do objetivo' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }))

    expect(push).toHaveBeenCalledWith('/objectives/o1/edit')
  })

  it('asks for confirmation before deleting, then calls the action', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    render(<ObjectiveActionsMenu objectiveId="o1" onDelete={onDelete} />)

    await userEvent.click(screen.getByRole('button', { name: 'Ações do objetivo' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Excluir…' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/todas as metas semanais e tarefas diárias/)).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('closes the menu with Escape', async () => {
    render(<ObjectiveActionsMenu objectiveId="o1" onDelete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Ações do objetivo' }))
    await screen.findByRole('menuitem', { name: 'Editar' })

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menuitem', { name: 'Editar' })).not.toBeInTheDocument()
  })
})
