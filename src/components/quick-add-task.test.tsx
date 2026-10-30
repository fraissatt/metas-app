import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickAddTask } from '@/components/quick-add-task'

const GOALS = [
  { id: 'run', title: 'Treinar 3x na semana' },
  { id: 'read', title: 'Ler 20 páginas por dia' },
  { id: 'words', title: 'Revisar vocabulário' },
]

const field = () => screen.getByRole('textbox', { name: 'Nova tarefa para hoje' })
const chip = (name: string) => screen.getByRole('button', { name })

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('QuickAddTask', () => {
  it('rests as one line with the goal that will receive the task', () => {
    render(<QuickAddTask goals={GOALS} onAdd={vi.fn()} />)

    expect(field()).toHaveAttribute('placeholder', 'O que você vai fazer hoje?')
    expect(screen.getByText('Treinar 3x na semana')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Adicionar tarefa' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Em qual meta' })).toBeNull()
  })

  it('opens the goals as options when focused, with the first one chosen', async () => {
    render(<QuickAddTask goals={GOALS} onAdd={vi.fn()} />)

    await userEvent.click(field())

    expect(screen.getByRole('group', { name: 'Em qual meta' })).toBeInTheDocument()
    expect(chip('Treinar 3x na semana')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('Ler 20 páginas por dia')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Adicionar tarefa' })).toBeDisabled()
  })

  it('adds with Enter in the default goal, then empties and keeps focus for the next one', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<QuickAddTask goals={GOALS} onAdd={onAdd} />)

    await userEvent.type(field(), 'Estudar inglês{Enter}')

    expect(onAdd).toHaveBeenCalledWith('run', 'Estudar inglês')
    expect(field()).toHaveValue('')
    expect(field()).toHaveFocus()
  })

  it('adds in the chosen goal and remembers it on this browser', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    const { unmount } = render(<QuickAddTask goals={GOALS} onAdd={onAdd} />)

    await userEvent.click(field())
    await userEvent.click(chip('Ler 20 páginas por dia'))
    await userEvent.type(field(), 'Ler capítulo 3')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar tarefa' }))

    expect(onAdd).toHaveBeenCalledWith('read', 'Ler capítulo 3')
    expect(window.localStorage.getItem('metas:quick-add-goal')).toBe('read')

    unmount()
    render(<QuickAddTask goals={GOALS} onAdd={onAdd} />)
    await userEvent.click(field())
    expect(chip('Ler 20 páginas por dia')).toHaveAttribute('aria-pressed', 'true')
  })

  it('falls back to the first goal when the remembered one is gone', async () => {
    window.localStorage.setItem('metas:quick-add-goal', 'deleted')
    render(<QuickAddTask goals={GOALS} onAdd={vi.fn()} />)

    await userEvent.click(field())

    expect(chip('Treinar 3x na semana')).toHaveAttribute('aria-pressed', 'true')
  })

  it('falls back to another goal when the chosen one disappears from the list', async () => {
    const { rerender } = render(<QuickAddTask goals={GOALS} onAdd={vi.fn()} />)
    await userEvent.click(field())
    await userEvent.click(chip('Ler 20 páginas por dia'))

    rerender(<QuickAddTask goals={[GOALS[0], GOALS[2]]} onAdd={vi.fn()} />)

    expect(chip('Treinar 3x na semana')).toHaveAttribute('aria-pressed', 'true')
  })

  it('works without browser storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<QuickAddTask goals={GOALS} onAdd={onAdd} />)

    await userEvent.click(field())
    await userEvent.click(chip('Revisar vocabulário'))
    await userEvent.type(field(), 'Flashcards{Enter}')

    expect(onAdd).toHaveBeenCalledWith('words', 'Flashcards')
  })

  it('does not submit an empty or blank task', async () => {
    const onAdd = vi.fn()
    render(<QuickAddTask goals={GOALS} onAdd={onAdd} />)

    await userEvent.type(field(), '   {Enter}')

    expect(onAdd).not.toHaveBeenCalled()
  })

  it('brings the text back and says so when the task could not be created', async () => {
    const onAdd = vi.fn().mockRejectedValue(new Error('offline'))
    render(<QuickAddTask goals={GOALS} onAdd={onAdd} />)

    await userEvent.type(field(), 'Estudar inglês{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('Não deu para adicionar. Tente de novo.')
    expect(field()).toHaveValue('Estudar inglês')
  })

  it('does not wipe what is typed while the previous task is being saved', async () => {
    let finish: () => void = () => {}
    const onAdd = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    render(<QuickAddTask goals={GOALS} onAdd={onAdd} />)

    await userEvent.type(field(), 'Primeira{Enter}')
    expect(field()).toHaveValue('')
    await userEvent.type(field(), 'Segunda')
    finish()

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1))
    expect(field()).toHaveValue('Segunda')
  })

  it('does not put the failed text over a task typed meanwhile', async () => {
    let fail: (error: Error) => void = () => {}
    const onAdd = vi.fn(() => new Promise<void>((_, reject) => (fail = reject)))
    render(<QuickAddTask goals={GOALS} onAdd={onAdd} />)

    await userEvent.type(field(), 'Primeira{Enter}')
    await userEvent.type(field(), 'Segunda')
    fail(new Error('offline'))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(field()).toHaveValue('Segunda')
  })

  it('keeps the field focused when a goal or the button is tapped (Safari does not focus buttons)', async () => {
    render(<QuickAddTask goals={GOALS} onAdd={vi.fn()} />)
    await userEvent.type(field(), 'Anotar')

    const goalDown = createEvent.mouseDown(chip('Ler 20 páginas por dia'))
    fireEvent(chip('Ler 20 páginas por dia'), goalDown)
    const submitDown = createEvent.mouseDown(chip('Adicionar tarefa'))
    fireEvent(chip('Adicionar tarefa'), submitDown)

    expect(goalDown.defaultPrevented).toBe(true)
    expect(submitDown.defaultPrevented).toBe(true)
  })

  it('does not submit when Enter confirms an IME composition', () => {
    const onAdd = vi.fn()
    render(<QuickAddTask goals={GOALS} onAdd={onAdd} />)
    fireEvent.change(field(), { target: { value: 'ação' } })

    const enter = createEvent.keyDown(field(), { key: 'Enter', isComposing: true })
    fireEvent(field(), enter)

    expect(enter.defaultPrevented).toBe(true)
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('has nothing to choose with a single goal', async () => {
    render(<QuickAddTask goals={[GOALS[0]]} onAdd={vi.fn()} />)

    await userEvent.click(field())

    expect(screen.queryByRole('group', { name: 'Em qual meta' })).toBeNull()
    expect(screen.getByText('Treinar 3x na semana')).toBeInTheDocument()
  })

  it('renders nothing without goals', () => {
    const { container } = render(<QuickAddTask goals={[]} onAdd={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
