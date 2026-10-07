import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskItem } from '@/components/task-item'
import { parseDay } from '@/lib/dates'

const task = {
  id: 'task-1',
  title: 'Alongar 10 minutos',
  date: new Date('2026-10-06T00:00:00-03:00'),
  completed: false,
}
const weekStart = new Date('2026-10-05T00:00:00-03:00') // Monday

function renderItem(overrides: Partial<Parameters<typeof TaskItem>[0]> = {}) {
  const props = {
    task,
    weekStart,
    onToggle: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<TaskItem {...props} />)
  return props
}

async function openMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'Ações de Alongar 10 minutos' }))
}

describe('TaskItem', () => {
  it('shows the task with its checkbox and toggles it', async () => {
    const { onToggle } = renderItem()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Alongar 10 minutos' }))
    expect(onToggle).toHaveBeenCalledWith('task-1')
  })

  it('shows the date only when asked', () => {
    renderItem({ showDate: true })
    expect(screen.getByText('06/10')).toBeInTheDocument()
  })

  it('edits the title and day in place and saves with Salvar', async () => {
    const { onUpdate } = renderItem()
    await openMenu()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }))

    const title = screen.getByRole('textbox', { name: 'Nome da tarefa' })
    expect(title).toHaveValue('Alongar 10 minutos')
    expect(title).toHaveFocus()
    await userEvent.clear(title)
    await userEvent.type(title, 'Alongar 15 minutos')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Dia da tarefa' }), '2026-10-08')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(onUpdate).toHaveBeenCalledOnce()
    const [id, formData] = vi.mocked(onUpdate).mock.calls[0]
    expect(id).toBe('task-1')
    expect((formData as FormData).get('title')).toBe('Alongar 15 minutos')
    expect((formData as FormData).get('date')).toBe('2026-10-08')
    expect(screen.queryByRole('textbox', { name: 'Nome da tarefa' })).not.toBeInTheDocument()
  })

  it('offers only the days of the task week, with the current day selected', async () => {
    renderItem()
    await openMenu()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }))
    const select = screen.getByRole('combobox', { name: 'Dia da tarefa' })
    expect(select).toHaveValue('2026-10-06')
    expect(screen.getAllByRole('option')).toHaveLength(7)
  })

  it('cancels editing with Esc without saving', async () => {
    const { onUpdate } = renderItem()
    await openMenu()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Nome da tarefa' }), ' extra{Escape}')
    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.getByText('Alongar 10 minutos')).toBeInTheDocument()
  })

  it('keeps the editor open with a message when saving fails', async () => {
    renderItem({ onUpdate: vi.fn().mockRejectedValue(new Error('boom')) })
    await openMenu()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.')
    expect(screen.getByRole('textbox', { name: 'Nome da tarefa' })).toBeInTheDocument()
  })

  it('deletes only after confirming', async () => {
    const { onDelete } = renderItem()
    await openMenu()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Excluir…' }))
    expect(onDelete).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }))
    expect(onDelete).toHaveBeenCalledWith('task-1')
  })

  it('the day picker shows the task week in Brasília: SEG 05 … DOM 11, current day selected', async () => {
    renderItem({ task: { ...task, date: parseDay('2026-10-06') }, weekStart: parseDay('2026-10-05') })
    await openMenu()
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }))
    expect(screen.getByRole('combobox', { name: 'Dia da tarefa' })).toHaveValue('2026-10-06')
    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options[0]).toBe('SEG 05')
    expect(options[6]).toBe('DOM 11')
  })
})
